import { useState, useEffect } from "react";
import { X, QrCode, Smartphone, Check, RefreshCw } from "lucide-react";

interface QrLoginProps {
  open: boolean;
  onClose: () => void;
}

export function QrLoginPage({ open, onClose }: QrLoginProps) {
  const [sessionId] = useState(() => Math.random().toString(36).slice(2, 10));
  const [status, setStatus] = useState<"waiting" | "scanned" | "confirmed">("waiting");
  const [timer, setTimer] = useState(120);

  // Countdown timer
  useEffect(() => {
    if (!open || status !== "waiting") return;
    const interval = setInterval(() => {
      setTimer((t) => {
        if (t <= 1) { clearInterval(interval); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [open, status]);

  const refresh = () => { setTimer(120); setStatus("waiting"); };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-background/70 backdrop-blur-sm" />
      <div onClick={(e) => e.stopPropagation()} className="relative w-full max-w-sm rounded-3xl glass-strong border border-border/60 shadow-elegant p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <QrCode className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-serif italic gradient-text">QR Login</h3>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-surface-hover">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        {status === "waiting" && (
          <div className="flex flex-col items-center gap-4">
            {/* QR Code */}
            <div className="relative">
              {timer > 0 ? (
                <div className="w-48 h-48 rounded-2xl bg-white p-3 shadow-lg">
                  <div className="w-full h-full grid grid-cols-11 gap-px">
                    {Array.from({ length: 121 }).map((_, i) => {
                      const row = Math.floor(i / 11);
                      const col = i % 11;
                      const isCorner = (row < 3 && col < 3) || (row < 3 && col > 7) || (row > 7 && col < 3);
                      const hash = (sessionId.charCodeAt(i % sessionId.length) * (i + 1)) % 3;
                      const filled = isCorner || hash === 0;
                      return <div key={i} className={`rounded-[1px] ${filled ? "bg-black" : "bg-white"}`} />;
                    })}
                  </div>
                </div>
              ) : (
                <div className="w-48 h-48 rounded-2xl bg-secondary flex flex-col items-center justify-center gap-2">
                  <p className="text-xs text-muted-foreground">QR expired</p>
                  <button onClick={refresh} className="flex items-center gap-1 text-xs text-primary hover:underline">
                    <RefreshCw className="h-3 w-3" /> Refresh
                  </button>
                </div>
              )}
            </div>

            {timer > 0 && (
              <p className="text-[10px] text-muted-foreground font-mono">Expires in {Math.floor(timer / 60)}:{(timer % 60).toString().padStart(2, "0")}</p>
            )}

            <div className="space-y-2 w-full">
              <p className="text-[9px] font-mono uppercase text-muted-foreground text-center">How to scan</p>
              <div className="space-y-1.5">
                {[
                  "Open Meshlink on your phone",
                  "Go to Settings → QR Login",
                  "Point camera at this QR code",
                  "Confirm login on your phone",
                ].map((step, i) => (
                  <div key={i} className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-primary text-[9px] font-bold flex-shrink-0">{i + 1}</span>
                    {step}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {status === "scanned" && (
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/20 animate-pulse">
              <Smartphone className="h-8 w-8 text-primary" />
            </div>
            <p className="text-sm font-medium text-foreground">Scanned!</p>
            <p className="text-xs text-muted-foreground text-center">Confirm login on your phone to continue</p>
          </div>
        )}

        {status === "confirmed" && (
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-online/20">
              <Check className="h-8 w-8 text-online" />
            </div>
            <p className="text-sm font-medium text-foreground">Logged in!</p>
            <p className="text-xs text-muted-foreground">Session synced successfully</p>
          </div>
        )}
      </div>
    </div>
  );
}
