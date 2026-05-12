/**
 * Meshlink Error Collector
 *
 * Automatically captures JavaScript errors, unhandled rejections,
 * and failed network requests. Stores them in memory and optionally
 * sends to Matrix room for server-side collection.
 *
 * Usage:
 *   import { errorCollector } from "@/lib/errorCollector";
 *   errorCollector.init(); // Call once on app start
 *   errorCollector.getErrors(); // Get collected errors
 *   errorCollector.getReport(); // Get formatted report
 */

export interface CollectedError {
  id: string;
  type: "js" | "promise" | "network" | "manual";
  message: string;
  source?: string;
  line?: number;
  col?: number;
  stack?: string;
  url?: string;
  status?: number;
  timestamp: number;
  count: number;
  userId?: string;
}

class ErrorCollector {
  private errors: Map<string, CollectedError> = new Map();
  private initialized = false;
  private maxErrors = 200;

  init() {
    if (this.initialized) return;
    this.initialized = true;

    // Catch JS errors
    window.addEventListener("error", (event) => {
      this.add({
        type: "js",
        message: event.message || "Unknown error",
        source: event.filename?.split("/").pop(),
        line: event.lineno,
        col: event.colno,
        stack: event.error?.stack?.slice(0, 300),
      });
    });

    // Catch unhandled promise rejections
    window.addEventListener("unhandledrejection", (event) => {
      const reason = event.reason;
      this.add({
        type: "promise",
        message: reason?.message || reason?.toString?.() || "Unhandled promise rejection",
        stack: reason?.stack?.slice(0, 300),
      });
    });

    // Intercept fetch to catch network errors
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      try {
        const resp = await originalFetch(...args);
        if (!resp.ok && resp.status >= 400) {
          const url = typeof args[0] === "string" ? args[0] : (args[0] as Request)?.url || "";
          // Skip known non-critical 404s
          const path = new URL(url, window.location.origin).pathname;
          const skip404 = ["/filter/", "meshlink-registry", "meshlink-shorts", "meshlink-videos", "meshlink-music", ".well-known"];
          if (resp.status === 404 && skip404.some((s) => path.includes(s))) {
            return resp;
          }
          // Skip 401 on whoami (normal on first load)
          if (resp.status === 401 && path.includes("whoami")) {
            return resp;
          }
          this.add({
            type: "network",
            message: `HTTP ${resp.status} ${resp.statusText}`,
            url: path,
            status: resp.status,
          });
        }
        return resp;
      } catch (err) {
        const url = typeof args[0] === "string" ? args[0] : "";
        this.add({
          type: "network",
          message: (err as Error)?.message || "Network error",
          url: new URL(url, window.location.origin).pathname,
        });
        throw err;
      }
    };

    // Load saved errors from sessionStorage
    try {
      const saved = sessionStorage.getItem("meshlink-errors");
      if (saved) {
        const parsed = JSON.parse(saved) as CollectedError[];
        for (const e of parsed) this.errors.set(e.id, e);
      }
    } catch { /* ignore */ }
  }

  private add(partial: Omit<CollectedError, "id" | "timestamp" | "count">) {
    // Create unique key based on type + message + url
    const key = `${partial.type}:${partial.message}:${partial.url || ""}:${partial.source || ""}`;
    const existing = this.errors.get(key);
    if (existing) {
      existing.count++;
      existing.timestamp = Date.now();
    } else {
      if (this.errors.size >= this.maxErrors) {
        // Remove oldest
        const oldest = [...this.errors.entries()].sort((a, b) => a[1].timestamp - b[1].timestamp)[0];
        if (oldest) this.errors.delete(oldest[0]);
      }
      this.errors.set(key, {
        ...partial,
        id: key,
        timestamp: Date.now(),
        count: 1,
      });
    }
    this.save();
  }

  /** Manually log an error */
  log(message: string, details?: string) {
    this.add({ type: "manual", message, stack: details });
  }

  private save() {
    try {
      sessionStorage.setItem("meshlink-errors", JSON.stringify([...this.errors.values()]));
    } catch { /* ignore */ }
  }

  /** Get all collected errors */
  getErrors(): CollectedError[] {
    return [...this.errors.values()].sort((a, b) => b.timestamp - a.timestamp);
  }

  /** Get error count by severity */
  getSummary(): { total: number; js: number; promise: number; network: number; manual: number } {
    const errors = this.getErrors();
    return {
      total: errors.reduce((sum, e) => sum + e.count, 0),
      js: errors.filter((e) => e.type === "js").reduce((sum, e) => sum + e.count, 0),
      promise: errors.filter((e) => e.type === "promise").reduce((sum, e) => sum + e.count, 0),
      network: errors.filter((e) => e.type === "network").reduce((sum, e) => sum + e.count, 0),
      manual: errors.filter((e) => e.type === "manual").reduce((sum, e) => sum + e.count, 0),
    };
  }

  /** Clear all errors */
  clear() {
    this.errors.clear();
    sessionStorage.removeItem("meshlink-errors");
  }

  /** Send errors to Matrix room for server-side collection */
  async sendToServer(baseUrl: string, token: string, roomId: string) {
    const errors = this.getErrors();
    if (errors.length === 0) return;
    const txn = `err${Date.now()}`;
    await fetch(`${baseUrl}/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/send/org.meshlink.error_report/${txn}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        errors: errors.slice(0, 50),
        summary: this.getSummary(),
        userAgent: navigator.userAgent,
        timestamp: Date.now(),
      }),
    }).catch(() => {});
  }
}

export const errorCollector = new ErrorCollector();
