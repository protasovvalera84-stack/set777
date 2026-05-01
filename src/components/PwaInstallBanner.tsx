import { useState, useEffect } from "react";
import { X, Download, Smartphone } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function PwaInstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(() => {
    return localStorage.getItem("meshlink-pwa-dismissed") === "true";
  });

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const result = await deferredPrompt.userChoice;
    if (result.outcome === "accepted") {
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem("meshlink-pwa-dismissed", "true");
  };

  // Don't show if already installed, dismissed, or no prompt available
  if (!deferredPrompt || dismissed) return null;

  // Don't show if already in standalone mode (installed)
  if (window.matchMedia("(display-mode: standalone)").matches) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-md animate-fade-in-up">
      <div className="rounded-2xl glass-strong border border-primary/30 shadow-elegant p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl gradient-primary shadow-glow flex-shrink-0">
            <Smartphone className="h-5 w-5 text-primary-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground">Install Meshlink</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Add to home screen for faster access and offline support
            </p>
          </div>
          <button onClick={handleDismiss} className="p-1 hover:bg-surface-hover rounded-lg flex-shrink-0">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
        <div className="flex gap-2 mt-3">
          <button
            onClick={handleInstall}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold gradient-primary text-primary-foreground shadow-glow hover:scale-[1.02] transition-all"
          >
            <Download className="h-3.5 w-3.5" /> Install
          </button>
          <button
            onClick={handleDismiss}
            className="rounded-xl px-4 py-2 text-xs text-muted-foreground hover:bg-surface-hover transition-all"
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
