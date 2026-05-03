import { useState, useRef, useEffect } from "react";
import { X, Eye, EyeOff, Minimize2, Shield, Clock, Smartphone, LogOut, Key } from "lucide-react";

/** View-once media overlay */
export function ViewOnceMedia({ url, type, onViewed }: { url: string; type: "image" | "video"; onViewed: () => void }) {
  const [revealed, setRevealed] = useState(false);

  if (!revealed) {
    return (
      <button onClick={() => setRevealed(true)} className="flex items-center gap-2 rounded-xl bg-primary/10 border border-primary/20 px-4 py-3 hover:bg-primary/20 transition-all">
        <Eye className="h-4 w-4 text-primary" />
        <span className="text-xs text-primary font-medium">View once · Tap to open</span>
      </button>
    );
  }

  return (
    <div className="relative rounded-xl overflow-hidden">
      {type === "image" ? (
        <img src={url} alt="" className="max-w-full max-h-64 rounded-xl" onLoad={() => setTimeout(onViewed, 5000)} />
      ) : (
        <video src={url} controls autoPlay className="max-w-full max-h-64 rounded-xl" onEnded={onViewed} />
      )}
      <div className="absolute top-2 right-2 flex items-center gap-1 bg-black/60 rounded-lg px-2 py-1">
        <EyeOff className="h-3 w-3 text-white" />
        <span className="text-[9px] text-white">View once</span>
      </div>
    </div>
  );
}

/** Audio waveform visualization (simple CSS bars) */
export function AudioWaveform({ playing }: { playing: boolean }) {
  return (
    <div className="flex items-end gap-0.5 h-6">
      {Array.from({ length: 20 }).map((_, i) => (
        <div
          key={i}
          className={`w-0.5 rounded-full transition-all ${playing ? "bg-primary animate-pulse" : "bg-muted-foreground/30"}`}
          style={{
            height: `${4 + Math.sin(i * 0.8) * 12 + Math.random() * 8}px`,
            animationDelay: `${i * 50}ms`,
          }}
        />
      ))}
    </div>
  );
}

/** Character counter for input */
export function CharCounter({ count, max }: { count: number; max: number }) {
  if (count === 0) return null;
  const pct = count / max;
  return (
    <span className={`text-[9px] font-mono ${pct > 0.9 ? "text-destructive" : pct > 0.7 ? "text-yellow-500" : "text-muted-foreground/40"}`}>
      {count}/{max}
    </span>
  );
}

/** Security audit page */
export function SecurityAuditPage({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;

  const loginHistory = [
    { device: "Chrome — Desktop", ip: "Current session", time: "Now", current: true },
    { device: "Mobile Browser", ip: "Previous", time: "Yesterday", current: false },
  ];

  return (
    <div className="fixed inset-0 z-[55] flex flex-col bg-background animate-fade-in-up">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border/40">
        <div>
          <h2 className="text-lg font-serif italic gradient-text">Security Audit</h2>
          <p className="text-[11px] text-muted-foreground">Review your account security</p>
        </div>
        <button onClick={onClose} className="rounded-xl p-2 hover:bg-surface-hover">
          <X className="h-5 w-5 text-muted-foreground" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {/* Security score */}
        <div className="rounded-2xl glass border border-primary/30 p-4 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full gradient-primary mx-auto mb-2">
            <Shield className="h-8 w-8 text-primary-foreground" />
          </div>
          <p className="text-2xl font-bold gradient-text">85/100</p>
          <p className="text-xs text-muted-foreground">Security Score</p>
        </div>

        {/* Checklist */}
        <div className="space-y-2">
          <p className="text-[9px] font-mono uppercase text-muted-foreground">Security Checklist</p>
          {[
            { label: "E2E Encryption", status: true, desc: "All messages encrypted" },
            { label: "Strong Password", status: true, desc: "Password meets requirements" },
            { label: "PIN Lock", status: !!localStorage.getItem("meshlink-pin"), desc: localStorage.getItem("meshlink-pin") ? "PIN enabled" : "Set a PIN for extra security" },
            { label: "2FA (TOTP)", status: false, desc: "Not yet enabled" },
            { label: "Key Verification", status: false, desc: "Verify contacts' keys" },
          ].map((item) => (
            <div key={item.label} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ${item.status ? "bg-online/10 border border-online/20" : "bg-secondary/30 border border-border/30"}`}>
              <div className={`h-2 w-2 rounded-full ${item.status ? "bg-online" : "bg-muted-foreground/30"}`} />
              <div className="flex-1">
                <p className="text-xs font-medium text-foreground">{item.label}</p>
                <p className="text-[10px] text-muted-foreground">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Login history */}
        <div className="space-y-2">
          <p className="text-[9px] font-mono uppercase text-muted-foreground">Login History</p>
          {loginHistory.map((entry, i) => (
            <div key={i} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ${entry.current ? "glass border border-primary/20" : "bg-secondary/20"}`}>
              <Smartphone className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <div className="flex-1">
                <p className="text-xs text-foreground">{entry.device}</p>
                <p className="text-[10px] text-muted-foreground">{entry.ip} · {entry.time}</p>
              </div>
              {entry.current && <span className="text-[9px] text-online font-medium">Active</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
