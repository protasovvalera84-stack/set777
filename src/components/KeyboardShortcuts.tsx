import { useState, useEffect } from "react";
import { X, Keyboard } from "lucide-react";

export function KeyboardShortcuts() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "?" && !e.ctrlKey && !e.metaKey && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) {
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  if (!open) return null;

  const shortcuts = [
    { keys: ["Ctrl", "F"], desc: "Search in chat" },
    { keys: ["?"], desc: "Show keyboard shortcuts" },
    { keys: ["Esc"], desc: "Close dialog / search" },
    { keys: ["Enter"], desc: "Send message" },
    { keys: ["Ctrl", "V"], desc: "Paste image from clipboard" },
    { keys: ["Drag"], desc: "Drop files to send" },
  ];

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 animate-fade-in-up" onClick={() => setOpen(false)}>
      <div className="absolute inset-0 bg-background/70 backdrop-blur-sm" />
      <div onClick={(e) => e.stopPropagation()} className="relative w-full max-w-sm rounded-3xl glass-strong border border-border/60 shadow-elegant p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Keyboard className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-serif italic gradient-text">Keyboard Shortcuts</h3>
          </div>
          <button onClick={() => setOpen(false)} className="rounded-lg p-1.5 hover:bg-surface-hover">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
        <div className="space-y-2">
          {shortcuts.map((s) => (
            <div key={s.desc} className="flex items-center justify-between rounded-xl px-3 py-2 hover:bg-surface-hover/50">
              <span className="text-xs text-foreground">{s.desc}</span>
              <div className="flex items-center gap-1">
                {s.keys.map((k) => (
                  <kbd key={k} className="px-2 py-0.5 rounded-lg bg-secondary border border-border/50 text-[10px] font-mono text-muted-foreground">
                    {k}
                  </kbd>
                ))}
              </div>
            </div>
          ))}
        </div>
        <p className="text-[9px] text-muted-foreground text-center mt-4">Press <kbd className="px-1 py-0.5 rounded bg-secondary text-[9px] font-mono">?</kbd> to toggle</p>
      </div>
    </div>
  );
}
