import { useState } from "react";
import { X, Download, Upload, UserPlus, Check, Trash2 } from "lucide-react";

// ===== Export/Import Settings =====
export function SettingsExport({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;

  const handleExport = () => {
    const settings: Record<string, string | null> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith("meshlink-")) {
        settings[key] = localStorage.getItem(key);
      }
    }
    const blob = new Blob([JSON.stringify(settings, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "meshlink-settings.json"; a.click();
    URL.revokeObjectURL(url);
    onClose();
  };

  const handleImport = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const settings = JSON.parse(reader.result as string);
          for (const [key, value] of Object.entries(settings)) {
            if (key.startsWith("meshlink-") && typeof value === "string") {
              localStorage.setItem(key, value);
            }
          }
          onClose();
          window.location.reload();
        } catch { /* invalid file */ }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-background/70 backdrop-blur-sm" />
      <div onClick={(e) => e.stopPropagation()} className="relative w-full max-w-xs rounded-3xl glass-strong border border-border/60 shadow-elegant p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-serif italic gradient-text">Settings</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-surface-hover">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
        <div className="space-y-2">
          <button onClick={handleExport} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 hover:bg-surface-hover transition-all">
            <Download className="h-4 w-4 text-primary" />
            <div className="text-left">
              <p className="text-sm font-medium text-foreground">Export Settings</p>
              <p className="text-[10px] text-muted-foreground">Download as JSON file</p>
            </div>
          </button>
          <button onClick={handleImport} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 hover:bg-surface-hover transition-all">
            <Upload className="h-4 w-4 text-accent" />
            <div className="text-left">
              <p className="text-sm font-medium text-foreground">Import Settings</p>
              <p className="text-[10px] text-muted-foreground">Load from JSON file</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}

// ===== Multi-Account Manager =====
interface Account {
  id: string;
  name: string;
  server: string;
  active: boolean;
}

export function MultiAccountManager({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [accounts, setAccounts] = useState<Account[]>(() => {
    try {
      const saved = localStorage.getItem("meshlink-accounts");
      if (saved) return JSON.parse(saved);
    } catch {}
    // Current account
    const session = localStorage.getItem("meshlink-session");
    if (session) {
      try {
        const s = JSON.parse(session);
        return [{ id: s.userId || "current", name: s.userId?.split(":")[0].replace("@", "") || "Current", server: s.homeserverUrl || "", active: true }];
      } catch {}
    }
    return [{ id: "current", name: "Current Account", server: "", active: true }];
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[55] flex flex-col bg-background animate-fade-in-up">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border/40">
        <div>
          <h2 className="text-lg font-serif italic gradient-text">Accounts</h2>
          <p className="text-[11px] text-muted-foreground">{accounts.length} account{accounts.length > 1 ? "s" : ""}</p>
        </div>
        <button onClick={onClose} className="rounded-xl p-2 hover:bg-surface-hover">
          <X className="h-5 w-5 text-muted-foreground" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
        {accounts.map((acc) => (
          <div key={acc.id} className={`flex items-center gap-3 rounded-2xl px-4 py-3 ${acc.active ? "glass border border-primary/30" : "glass border border-border/30"}`}>
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${acc.active ? "gradient-primary text-primary-foreground" : "bg-secondary text-foreground"} text-sm font-bold`}>
              {acc.name[0]?.toUpperCase() || "?"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{acc.name}</p>
              <p className="text-[10px] text-muted-foreground truncate">{acc.server || "Current server"}</p>
            </div>
            {acc.active && <Check className="h-4 w-4 text-primary" />}
          </div>
        ))}
        <button className="flex w-full items-center gap-3 rounded-2xl border border-dashed border-primary/40 px-4 py-3 text-primary hover:bg-primary/5">
          <UserPlus className="h-4 w-4" />
          <span className="text-sm font-medium">Add Account</span>
        </button>
      </div>
    </div>
  );
}
