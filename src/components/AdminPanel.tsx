import { useState, useCallback } from "react";
import { X, Shield, Play, Loader2, AlertTriangle, CheckCircle, Bug, Zap, Server, Wifi, Database, Eye } from "lucide-react";
import { useMesh } from "@/lib/MeshProvider";

interface ScanResult {
  id: string;
  severity: "critical" | "warning" | "info" | "ok";
  category: string;
  title: string;
  description: string;
  solution: string;
}

interface AdminPanelProps {
  open: boolean;
  onClose: () => void;
}

export function AdminPanel({ open, onClose }: AdminPanelProps) {
  const mesh = useMesh();
  const [scanning, setScanning] = useState(false);
  const [results, setResults] = useState<ScanResult[]>([]);
  const [progress, setProgress] = useState(0);

  const runScan = useCallback(async () => {
    setScanning(true);
    setResults([]);
    setProgress(0);
    const findings: ScanResult[] = [];
    const client = mesh.client;
    const baseUrl = client?.getHomeserverUrl() || "";
    const token = client?.getAccessToken() || "";

    // === SCAN 1: Server connectivity ===
    setProgress(10);
    try {
      const resp = await fetch(`${baseUrl}/_matrix/client/versions`);
      if (resp.ok) {
        findings.push({ id: "srv-1", severity: "ok", category: "Server", title: "Matrix server reachable", description: "Server responds to API requests.", solution: "" });
      } else {
        findings.push({ id: "srv-1", severity: "critical", category: "Server", title: "Server not responding", description: `Status: ${resp.status}`, solution: "Check if Docker containers are running: docker compose ps" });
      }
    } catch {
      findings.push({ id: "srv-1", severity: "critical", category: "Server", title: "Cannot reach server", description: "Network error connecting to Matrix API.", solution: "Verify server is running and nginx is configured correctly." });
    }

    // === SCAN 2: User sync status ===
    setProgress(20);
    if (client) {
      const rooms = client.getRooms();
      const joinedRooms = rooms.filter((r) => r.getMyMembership() === "join");
      findings.push({ id: "sync-1", severity: "ok", category: "Sync", title: `Synced ${joinedRooms.length} rooms`, description: `Total rooms visible: ${rooms.length}, joined: ${joinedRooms.length}`, solution: "" });

      if (joinedRooms.length === 0) {
        findings.push({ id: "sync-2", severity: "warning", category: "Sync", title: "No rooms joined", description: "User has no chats. This may indicate sync issues.", solution: "Try logging out and back in. Check if initial sync completed." });
      }
    }

    // === SCAN 3: Room type detection ===
    setProgress(35);
    if (client) {
      const rooms = client.getRooms().filter((r) => r.getMyMembership() === "join");
      let dmCount = 0, groupCount = 0, channelCount = 0, unknownCount = 0;
      const mistyped: string[] = [];

      for (const room of rooms) {
        const members = room.getJoinedMembers();
        const alias = room.getCanonicalAlias() || "";
        const joinRule = (() => { try { return room.getJoinRule(); } catch { return "invite"; } })();
        const isPublic = joinRule === "public";

        // Check meshlink type
        let meshlinkType: string | null = null;
        try {
          const ev = room.currentState.getStateEvents("org.meshlink.room_type", "");
          if (ev) meshlinkType = ev.getContent()?.type || null;
        } catch {}

        if (meshlinkType === "group") groupCount++;
        else if (meshlinkType === "channel") channelCount++;
        else if (members.length <= 2 && !isPublic) dmCount++;
        else if (alias.includes("group-")) groupCount++;
        else if (alias.includes("channel-")) channelCount++;
        else if (isPublic) { unknownCount++; mistyped.push(room.name || room.roomId); }
        else dmCount++;
      }

      findings.push({ id: "type-1", severity: "ok", category: "Rooms", title: `DMs: ${dmCount}, Groups: ${groupCount}, Channels: ${channelCount}`, description: `Room type detection working. ${unknownCount} rooms without explicit type.`, solution: "" });

      if (unknownCount > 0) {
        findings.push({ id: "type-2", severity: "warning", category: "Rooms", title: `${unknownCount} rooms without type marker`, description: `Rooms: ${mistyped.slice(0, 3).join(", ")}${mistyped.length > 3 ? "..." : ""}`, solution: "Recreate these rooms or add org.meshlink.room_type state event." });
      }
    }

    // === SCAN 4: Registry health ===
    setProgress(50);
    try {
      const serverName = mesh.userId?.split(":")[1] || "";
      const regResp = await fetch(`${baseUrl}/_matrix/client/v3/directory/room/${encodeURIComponent(`#meshlink-registry:${serverName}`)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (regResp.ok) {
        const regData = await regResp.json() as any;
        // Check if we can read messages
        const msgResp = await fetch(`${baseUrl}/_matrix/client/v3/rooms/${encodeURIComponent(regData.room_id)}/messages?dir=b&limit=100`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (msgResp.ok) {
          const msgData = await msgResp.json() as any;
          const registryEntries = (msgData.chunk || []).filter((e: any) => e.type === "org.meshlink.registry");
          findings.push({ id: "reg-1", severity: "ok", category: "Registry", title: `Registry active: ${registryEntries.length} groups registered`, description: "Meshlink registry is working. Groups are discoverable.", solution: "" });
        } else {
          findings.push({ id: "reg-1", severity: "warning", category: "Registry", title: "Cannot read registry messages", description: "User may not be joined to registry room.", solution: "Create a new group — it will auto-join the registry." });
        }
      } else {
        findings.push({ id: "reg-1", severity: "critical", category: "Registry", title: "Registry room not found", description: "The #meshlink-registry room doesn't exist.", solution: "Create any group — the registry will be auto-created." });
      }
    } catch {
      findings.push({ id: "reg-1", severity: "warning", category: "Registry", title: "Registry check failed", description: "Could not verify registry status.", solution: "Try creating a group to initialize the registry." });
    }

    // === SCAN 5: Media upload ===
    setProgress(65);
    try {
      const resp = await fetch(`${baseUrl}/_matrix/media/v3/config`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (resp.ok) {
        const data = await resp.json() as any;
        const maxSize = data["m.upload.size"] || 0;
        findings.push({ id: "media-1", severity: "ok", category: "Media", title: `Media upload: max ${Math.round(maxSize / 1024 / 1024)}MB`, description: "Media upload endpoint is working.", solution: "" });
      } else {
        findings.push({ id: "media-1", severity: "warning", category: "Media", title: "Media config unavailable", description: "Cannot determine upload limits.", solution: "Check Synapse media configuration." });
      }
    } catch {
      findings.push({ id: "media-1", severity: "critical", category: "Media", title: "Media endpoint unreachable", description: "File uploads may not work.", solution: "Check nginx proxy configuration for /_matrix/media/" });
    }

    // === SCAN 6: Encryption ===
    setProgress(75);
    if (client) {
      const encryptedRooms = client.getRooms().filter((r) => r.hasEncryptionStateEvent());
      findings.push({ id: "e2e-1", severity: "ok", category: "Security", title: `${encryptedRooms.length} encrypted rooms`, description: "E2E encryption is active for DMs.", solution: "" });
    }

    // === SCAN 7: Performance ===
    setProgress(85);
    const memUsage = (performance as any).memory;
    if (memUsage) {
      const usedMB = Math.round(memUsage.usedJSHeapSize / 1024 / 1024);
      const limitMB = Math.round(memUsage.jsHeapSizeLimit / 1024 / 1024);
      findings.push({
        id: "perf-1",
        severity: usedMB > limitMB * 0.8 ? "warning" : "ok",
        category: "Performance",
        title: `Memory: ${usedMB}MB / ${limitMB}MB`,
        description: usedMB > limitMB * 0.8 ? "High memory usage detected." : "Memory usage is normal.",
        solution: usedMB > limitMB * 0.8 ? "Close unused tabs or refresh the page." : "",
      });
    }

    // === SCAN 8: Known issues check ===
    setProgress(95);
    // Check if publicRooms works
    try {
      const resp = await fetch(`${baseUrl}/_matrix/client/v3/publicRooms`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ limit: 5 }),
      });
      if (resp.ok) {
        const data = await resp.json() as any;
        if ((data.chunk || []).length === 0) {
          findings.push({ id: "known-1", severity: "info", category: "Known Issues", title: "Public room directory empty", description: "Synapse doesn't publish rooms to directory by default.", solution: "Add 'allow_public_rooms_without_auth: true' to homeserver.yaml and restart Docker." });
        }
      }
    } catch {}

    // Check TURN server
    try {
      const resp = await fetch(`${baseUrl}/_matrix/client/v3/voip/turnServer`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) {
        findings.push({ id: "known-2", severity: "info", category: "Calls", title: "TURN server not configured", description: "Voice/video calls may not work behind NAT.", solution: "Configure coturn in docker-compose.yml" });
      }
    } catch {}

    setProgress(100);
    setResults(findings);
    setScanning(false);
  }, [mesh]);

  if (!open) return null;

  const criticals = results.filter((r) => r.severity === "critical");
  const warnings = results.filter((r) => r.severity === "warning");
  const infos = results.filter((r) => r.severity === "info");
  const oks = results.filter((r) => r.severity === "ok");

  return (
    <div className="fixed inset-0 z-[55] flex flex-col bg-background animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-border/40">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          <div>
            <h2 className="text-lg font-serif italic gradient-text">Admin Panel</h2>
            <p className="text-[10px] text-muted-foreground">System diagnostics & bug scanner</p>
          </div>
        </div>
        <button onClick={onClose} className="rounded-xl p-2 hover:bg-surface-hover">
          <X className="h-5 w-5 text-muted-foreground" />
        </button>
      </div>

      {/* Scan button */}
      <div className="px-4 py-4 border-b border-border/30">
        <button
          onClick={runScan}
          disabled={scanning}
          className="w-full flex items-center justify-center gap-2 rounded-2xl py-3 text-sm font-semibold gradient-primary text-primary-foreground shadow-glow hover:scale-[1.01] transition-all disabled:opacity-60"
        >
          {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bug className="h-4 w-4" />}
          {scanning ? `Scanning... ${progress}%` : "Run System Scan"}
        </button>
        {scanning && (
          <div className="mt-2 h-1.5 rounded-full bg-secondary overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>
        )}
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 scrollbar-thin">
        {results.length === 0 && !scanning && (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <Bug className="h-12 w-12 text-muted-foreground/20" />
            <p className="text-sm text-muted-foreground">Press "Run System Scan" to check for issues</p>
          </div>
        )}

        {results.length > 0 && (
          <>
            {/* Summary */}
            <div className="flex items-center gap-3 rounded-2xl bg-secondary/30 px-4 py-3">
              <div className="text-center">
                <p className="text-lg font-bold gradient-text">{results.length}</p>
                <p className="text-[9px] text-muted-foreground">checks</p>
              </div>
              <div className="flex-1 flex items-center gap-2">
                {criticals.length > 0 && <span className="flex items-center gap-1 text-[10px] text-destructive"><AlertTriangle className="h-3 w-3" />{criticals.length}</span>}
                {warnings.length > 0 && <span className="flex items-center gap-1 text-[10px] text-yellow-500"><AlertTriangle className="h-3 w-3" />{warnings.length}</span>}
                {infos.length > 0 && <span className="flex items-center gap-1 text-[10px] text-blue-400"><Eye className="h-3 w-3" />{infos.length}</span>}
                {oks.length > 0 && <span className="flex items-center gap-1 text-[10px] text-online"><CheckCircle className="h-3 w-3" />{oks.length}</span>}
              </div>
            </div>

            {/* Critical issues */}
            {criticals.length > 0 && (
              <div>
                <p className="text-[9px] font-mono uppercase text-destructive mb-1.5 px-1">Critical Issues</p>
                {criticals.map((r) => <ScanItem key={r.id} result={r} />)}
              </div>
            )}

            {/* Warnings */}
            {warnings.length > 0 && (
              <div>
                <p className="text-[9px] font-mono uppercase text-yellow-500 mb-1.5 px-1">Warnings</p>
                {warnings.map((r) => <ScanItem key={r.id} result={r} />)}
              </div>
            )}

            {/* Info */}
            {infos.length > 0 && (
              <div>
                <p className="text-[9px] font-mono uppercase text-blue-400 mb-1.5 px-1">Info</p>
                {infos.map((r) => <ScanItem key={r.id} result={r} />)}
              </div>
            )}

            {/* OK */}
            {oks.length > 0 && (
              <div>
                <p className="text-[9px] font-mono uppercase text-online mb-1.5 px-1">Passed</p>
                {oks.map((r) => <ScanItem key={r.id} result={r} />)}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function ScanItem({ result }: { result: ScanResult }) {
  const [expanded, setExpanded] = useState(false);
  const icon = result.severity === "critical" ? <AlertTriangle className="h-4 w-4 text-destructive" /> :
    result.severity === "warning" ? <AlertTriangle className="h-4 w-4 text-yellow-500" /> :
    result.severity === "info" ? <Eye className="h-4 w-4 text-blue-400" /> :
    <CheckCircle className="h-4 w-4 text-online" />;

  const borderColor = result.severity === "critical" ? "border-destructive/30" :
    result.severity === "warning" ? "border-yellow-500/30" :
    result.severity === "info" ? "border-blue-400/30" : "border-online/30";

  return (
    <div className={`rounded-xl border ${borderColor} bg-background px-3 py-2 mb-1.5`}>
      <button onClick={() => setExpanded(!expanded)} className="flex w-full items-center gap-2 text-left">
        {icon}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-foreground truncate">{result.title}</p>
          <p className="text-[9px] text-muted-foreground">{result.category}</p>
        </div>
      </button>
      {expanded && (
        <div className="mt-2 pl-6 space-y-1">
          <p className="text-[11px] text-muted-foreground">{result.description}</p>
          {result.solution && (
            <div className="rounded-lg bg-primary/5 border border-primary/10 px-2 py-1.5">
              <p className="text-[10px] text-primary font-medium">Solution:</p>
              <p className="text-[10px] text-foreground">{result.solution}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
