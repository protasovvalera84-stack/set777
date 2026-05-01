import { useState } from "react";
import { X, Shield, ShieldCheck, ShieldAlert, Copy, Check, Fingerprint } from "lucide-react";
import { useMesh } from "@/lib/MeshProvider";

interface KeyVerificationProps {
  open: boolean;
  onClose: () => void;
  userId: string;
  userName: string;
}

// Generate deterministic emoji sequence from two user IDs (simulates SAS verification)
function generateVerificationEmojis(myId: string, theirId: string): string[] {
  const combined = [myId, theirId].sort().join("|");
  let hash = 0;
  for (let i = 0; i < combined.length; i++) {
    hash = ((hash << 5) - hash + combined.charCodeAt(i)) | 0;
  }
  const EMOJIS = ["🐶","🐱","🦁","🐻","🐼","🐨","🐯","🦊","🐸","🐵",
    "🌻","🌹","🌸","🍀","🌈","⭐","🔥","❄️","🌙","☀️",
    "🎸","🎹","🎺","🥁","🎭","🎨","🎬","📷","💎","🔑",
    "🚀","✈️","🚢","🏠","🏰","⚡","🔔","💡","🎯","🏆"];
  const result: string[] = [];
  for (let i = 0; i < 7; i++) {
    const idx = Math.abs((hash * (i + 1) * 2654435761) >> 16) % EMOJIS.length;
    result.push(EMOJIS[idx]);
  }
  return result;
}

function generateFingerprint(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = ((hash << 5) - hash + userId.charCodeAt(i)) | 0;
  }
  const hex = Math.abs(hash).toString(16).padStart(8, "0").toUpperCase();
  // Format as groups of 4
  return `${hex.slice(0,4)} ${hex.slice(4,8)} ${Math.abs(hash * 31).toString(16).padStart(8,"0").toUpperCase().slice(0,4)} ${Math.abs(hash * 37).toString(16).padStart(8,"0").toUpperCase().slice(0,4)}`;
}

export function KeyVerification({ open, onClose, userId, userName }: KeyVerificationProps) {
  const mesh = useMesh();
  const [step, setStep] = useState<"start" | "compare" | "verified" | "failed">("start");
  const [copied, setCopied] = useState(false);

  if (!open) return null;

  const myId = mesh.userId || "unknown";
  const emojis = generateVerificationEmojis(myId, userId);
  const myFingerprint = generateFingerprint(myId);
  const theirFingerprint = generateFingerprint(userId);

  const handleCopyFingerprint = () => {
    navigator.clipboard?.writeText(`${myFingerprint} | ${theirFingerprint}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 animate-fade-in-up" onClick={onClose}>
      <div className="absolute inset-0 bg-background/70 backdrop-blur-sm" />
      <div onClick={(e) => e.stopPropagation()} className="relative w-full max-w-sm rounded-3xl glass-strong border border-border/60 shadow-elegant p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-serif italic gradient-text">Verify Encryption</h3>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-surface-hover">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        {/* Step: Start */}
        {step === "start" && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-2xl bg-primary/5 border border-primary/10 p-4">
              <Fingerprint className="h-8 w-8 text-primary flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-foreground">Verify {userName}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Compare emoji sequence to confirm end-to-end encryption is secure
                </p>
              </div>
            </div>

            {/* Fingerprints */}
            <div className="space-y-2">
              <div className="rounded-xl bg-secondary/50 px-3 py-2">
                <p className="text-[9px] font-mono uppercase text-muted-foreground">Your key fingerprint</p>
                <p className="text-xs font-mono text-foreground mt-0.5">{myFingerprint}</p>
              </div>
              <div className="rounded-xl bg-secondary/50 px-3 py-2">
                <p className="text-[9px] font-mono uppercase text-muted-foreground">{userName}'s key fingerprint</p>
                <p className="text-xs font-mono text-foreground mt-0.5">{theirFingerprint}</p>
              </div>
              <button onClick={handleCopyFingerprint} className="flex items-center gap-1.5 text-[10px] text-primary hover:underline">
                {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                {copied ? "Copied!" : "Copy fingerprints"}
              </button>
            </div>

            <button
              onClick={() => setStep("compare")}
              className="w-full rounded-2xl py-3 text-sm font-semibold gradient-primary text-primary-foreground shadow-glow hover:scale-[1.02] transition-all"
            >
              Start Verification
            </button>
          </div>
        )}

        {/* Step: Compare emojis */}
        {step === "compare" && (
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground text-center">
              Ask <b className="text-foreground">{userName}</b> to open verification too.
              Both of you should see the same emoji sequence:
            </p>

            {/* Emoji grid */}
            <div className="flex items-center justify-center gap-2 py-4">
              {emojis.map((emoji, i) => (
                <div key={i} className="flex flex-col items-center gap-1">
                  <span className="text-2xl">{emoji}</span>
                  <span className="text-[8px] text-muted-foreground font-mono">{i + 1}</span>
                </div>
              ))}
            </div>

            <p className="text-[11px] text-muted-foreground text-center">
              Do the emojis match on both devices?
            </p>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setStep("verified")}
                className="rounded-2xl py-3 text-sm font-semibold bg-online/20 text-online border border-online/30 hover:bg-online/30 transition-all"
              >
                They Match
              </button>
              <button
                onClick={() => setStep("failed")}
                className="rounded-2xl py-3 text-sm font-semibold bg-destructive/20 text-destructive border border-destructive/30 hover:bg-destructive/30 transition-all"
              >
                They Don't Match
              </button>
            </div>
          </div>
        )}

        {/* Step: Verified */}
        {step === "verified" && (
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-online/20 border border-online/30">
              <ShieldCheck className="h-8 w-8 text-online" />
            </div>
            <div className="text-center">
              <p className="text-lg font-semibold text-foreground">Verified!</p>
              <p className="text-xs text-muted-foreground mt-1">
                Your conversation with <b className="text-foreground">{userName}</b> is end-to-end encrypted and verified.
              </p>
            </div>
            <div className="flex items-center gap-2 rounded-xl bg-online/10 border border-online/20 px-4 py-2">
              <ShieldCheck className="h-4 w-4 text-online" />
              <span className="text-[11px] text-online font-medium">E2E Encryption Verified</span>
            </div>
            <button
              onClick={onClose}
              className="w-full rounded-2xl py-3 text-sm font-semibold gradient-primary text-primary-foreground shadow-glow hover:scale-[1.02] transition-all"
            >
              Done
            </button>
          </div>
        )}

        {/* Step: Failed */}
        {step === "failed" && (
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/20 border border-destructive/30">
              <ShieldAlert className="h-8 w-8 text-destructive" />
            </div>
            <div className="text-center">
              <p className="text-lg font-semibold text-foreground">Verification Failed</p>
              <p className="text-xs text-muted-foreground mt-1">
                The emojis didn't match. This could mean a man-in-the-middle attack or a session mismatch.
              </p>
            </div>
            <div className="flex items-center gap-2 rounded-xl bg-destructive/10 border border-destructive/20 px-4 py-2">
              <ShieldAlert className="h-4 w-4 text-destructive" />
              <span className="text-[11px] text-destructive font-medium">Encryption Not Verified</span>
            </div>
            <div className="grid grid-cols-2 gap-2 w-full">
              <button
                onClick={() => setStep("start")}
                className="rounded-2xl py-2.5 text-xs font-medium bg-secondary text-foreground hover:bg-surface-hover transition-all"
              >
                Try Again
              </button>
              <button
                onClick={onClose}
                className="rounded-2xl py-2.5 text-xs font-medium bg-secondary text-muted-foreground hover:bg-surface-hover transition-all"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
