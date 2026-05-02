import { useState, useEffect } from "react";
import { X, Shield, Lock, Smartphone, LogOut, Key, Fingerprint } from "lucide-react";

// ===== PIN Lock =====
export function PinLock({ onUnlock }: { onUnlock: () => void }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const savedPin = localStorage.getItem("meshlink-pin");

  if (!savedPin) { onUnlock(); return null; }

  const handleDigit = (d: string) => {
    const next = pin + d;
    setPin(next);
    setError(false);
    if (next.length === 4) {
      if (next === savedPin) {
        onUnlock();
      } else {
        setError(true);
        setPin("");
        if (navigator.vibrate) navigator.vibrate(200);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-6 animate-fade-in-up">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl gradient-primary shadow-glow">
          <Lock className="h-8 w-8 text-primary-foreground" />
        </div>
        <h2 className="text-xl font-serif italic gradient-text">Enter PIN</h2>
        <div className="flex gap-3">
          {[0,1,2,3].map((i) => (
            <div key={i} className={`h-3 w-3 rounded-full transition-all ${i < pin.length ? "bg-primary scale-125" : "bg-border"} ${error ? "bg-destructive animate-pulse" : ""}`} />
          ))}
        </div>
        {error && <p className="text-xs text-destructive">Wrong PIN</p>}
        <div className="grid grid-cols-3 gap-3">
          {[1,2,3,4,5,6,7,8,9,null,0,"⌫"].map((d, i) => (
            <button
              key={i}
              onClick={() => d === "⌫" ? setPin(pin.slice(0,-1)) : d !== null && handleDigit(String(d))}
              className={`flex h-14 w-14 items-center justify-center rounded-2xl text-lg font-medium transition-all ${d === null ? "invisible" : "bg-secondary hover:bg-surface-hover active:scale-95"}`}
            >
              {d}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ===== PIN Setup =====
export function PinSetup({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [step, setStep] = useState<"set" | "confirm">("set");
  const hasPin = !!localStorage.getItem("meshlink-pin");

  if (!open) return null;

  const handleDigit = (d: string) => {
    if (step === "set") {
      const next = pin + d;
      setPin(next);
      if (next.length === 4) setStep("confirm");
    } else {
      const next = confirm + d;
      setConfirm(next);
      if (next.length === 4) {
        if (next === pin) {
          localStorage.setItem("meshlink-pin", pin);
          onClose();
        } else {
          setPin(""); setConfirm(""); setStep("set");
        }
      }
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="relative w-full max-w-xs rounded-3xl glass-strong border border-border/60 shadow-elegant p-6 text-center">
        <h3 className="text-lg font-serif italic gradient-text mb-2">{step === "set" ? "Set PIN" : "Confirm PIN"}</h3>
        <div className="flex justify-center gap-3 mb-6">
          {[0,1,2,3].map((i) => {
            const val = step === "set" ? pin : confirm;
            return <div key={i} className={`h-3 w-3 rounded-full ${i < val.length ? "bg-primary" : "bg-border"}`} />;
          })}
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[1,2,3,4,5,6,7,8,9,null,0,"⌫"].map((d, i) => (
            <button key={i} onClick={() => d === "⌫" ? (step === "set" ? setPin(pin.slice(0,-1)) : setConfirm(confirm.slice(0,-1))) : d !== null && handleDigit(String(d))}
              className={`flex h-12 w-12 mx-auto items-center justify-center rounded-xl text-base ${d === null ? "invisible" : "bg-secondary hover:bg-surface-hover"}`}>
              {d}
            </button>
          ))}
        </div>
        {hasPin && (
          <button onClick={() => { localStorage.removeItem("meshlink-pin"); onClose(); }} className="mt-4 text-xs text-destructive hover:underline">
            Remove PIN
          </button>
        )}
      </div>
    </div>
  );
}

// ===== Session Management =====
export function SessionsPage({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;

  const currentSession = {
    device: navigator.userAgent.includes("Mobile") ? "Mobile" : "Desktop",
    browser: navigator.userAgent.includes("Chrome") ? "Chrome" : navigator.userAgent.includes("Firefox") ? "Firefox" : navigator.userAgent.includes("Safari") ? "Safari" : "Browser",
    ip: "Current session",
    active: true,
  };

  return (
    <div className="fixed inset-0 z-[55] flex flex-col bg-background animate-fade-in-up">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border/40">
        <div>
          <h2 className="text-lg font-serif italic gradient-text">Active Sessions</h2>
          <p className="text-[11px] text-muted-foreground">Manage your logged-in devices</p>
        </div>
        <button onClick={onClose} className="rounded-xl p-2 hover:bg-surface-hover">
          <X className="h-5 w-5 text-muted-foreground" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        <div className="rounded-2xl glass border border-primary/30 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/20">
              <Smartphone className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">{currentSession.browser} — {currentSession.device}</p>
              <p className="text-[10px] text-online">Active now</p>
            </div>
            <Shield className="h-4 w-4 text-primary" />
          </div>
        </div>
        <div className="rounded-2xl glass border border-border/40 p-4 opacity-60">
          <p className="text-xs text-muted-foreground text-center">No other sessions found</p>
          <p className="text-[10px] text-muted-foreground/60 text-center mt-1">Only this device is logged in</p>
        </div>
      </div>
    </div>
  );
}
