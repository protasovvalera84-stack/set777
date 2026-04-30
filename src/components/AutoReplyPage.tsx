import { useState, useEffect } from "react";
import { X, Bot, Power, PowerOff, Clock, MessageSquare, Edit3 } from "lucide-react";

interface AutoReplySettings {
  enabled: boolean;
  message: string;
  schedule: "always" | "outside_hours" | "custom";
  startHour: number;
  endHour: number;
  replyOnce: boolean; // Only reply once per user per session
  repliedTo: string[]; // Track who we already replied to
}

interface AutoReplyPageProps {
  open: boolean;
  onClose: () => void;
}

const DEFAULT_SETTINGS: AutoReplySettings = {
  enabled: false,
  message: "I'm currently away. I'll get back to you soon! 🤖",
  schedule: "always",
  startHour: 9,
  endHour: 18,
  replyOnce: true,
  repliedTo: [],
};

const PRESET_MESSAGES = [
  "I'm currently away. I'll get back to you soon! 🤖",
  "Thanks for your message! I'm busy right now but will reply later.",
  "🌙 I'm sleeping. Will respond in the morning!",
  "📵 Do not disturb. Emergency? Call me.",
  "🏖️ On vacation until next week. See you soon!",
  "💼 In a meeting. Will reply after.",
  "🎮 Gaming right now. BRB!",
];

export function AutoReplyPage({ open, onClose }: AutoReplyPageProps) {
  const [settings, setSettings] = useState<AutoReplySettings>(() => {
    try {
      const saved = localStorage.getItem("meshlink-autoreply");
      return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS;
    } catch { return DEFAULT_SETTINGS; }
  });
  const [customMsg, setCustomMsg] = useState(settings.message);
  const [editingMsg, setEditingMsg] = useState(false);

  // Save settings
  useEffect(() => {
    localStorage.setItem("meshlink-autoreply", JSON.stringify(settings));
  }, [settings]);

  const toggleEnabled = () => {
    setSettings((s) => ({ ...s, enabled: !s.enabled, repliedTo: [] }));
  };

  const setMessage = (msg: string) => {
    setSettings((s) => ({ ...s, message: msg }));
    setCustomMsg(msg);
    setEditingMsg(false);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[55] flex flex-col bg-background animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border/40">
        <div>
          <h2 className="text-lg font-serif italic gradient-text">Auto-Reply</h2>
          <p className="text-[11px] text-muted-foreground">Automatic away message bot</p>
        </div>
        <button onClick={onClose} className="rounded-xl p-2 hover:bg-surface-hover">
          <X className="h-5 w-5 text-muted-foreground" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
        {/* Enable toggle */}
        <div className="rounded-2xl glass border border-border/40 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Bot className={`h-5 w-5 ${settings.enabled ? "text-primary" : "text-muted-foreground"}`} />
              <div>
                <p className="text-sm font-medium text-foreground">Auto-Reply Bot</p>
                <p className="text-[10px] text-muted-foreground">{settings.enabled ? "Active — replying automatically" : "Disabled"}</p>
              </div>
            </div>
            <button
              onClick={toggleEnabled}
              className={`rounded-full p-2.5 transition-all ${settings.enabled ? "bg-primary/20 text-primary" : "bg-secondary text-muted-foreground hover:bg-surface-hover"}`}
            >
              {settings.enabled ? <Power className="h-4 w-4" /> : <PowerOff className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Message */}
        <div className="rounded-2xl glass border border-border/40 p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[9px] font-mono uppercase tracking-[0.15em] text-muted-foreground">Reply Message</p>
            <button onClick={() => setEditingMsg(true)} className="text-[9px] text-primary hover:underline flex items-center gap-1">
              <Edit3 className="h-3 w-3" /> Edit
            </button>
          </div>

          {editingMsg ? (
            <div className="space-y-2">
              <textarea
                value={customMsg}
                onChange={(e) => setCustomMsg(e.target.value)}
                rows={3}
                className="w-full rounded-xl glass border border-border/50 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 bg-transparent resize-none"
              />
              <div className="flex gap-2">
                <button onClick={() => setMessage(customMsg)} className="text-xs text-primary font-medium">Save</button>
                <button onClick={() => setEditingMsg(false)} className="text-xs text-muted-foreground">Cancel</button>
              </div>
            </div>
          ) : (
            <div className="rounded-xl bg-primary/5 border border-primary/10 px-3 py-2.5">
              <p className="text-sm text-foreground">{settings.message}</p>
            </div>
          )}

          {/* Presets */}
          <div className="mt-3 space-y-1">
            <p className="text-[9px] font-mono uppercase text-muted-foreground mb-1.5">Quick presets</p>
            {PRESET_MESSAGES.map((msg) => (
              <button
                key={msg}
                onClick={() => setMessage(msg)}
                className={`w-full text-left rounded-xl px-3 py-2 text-[11px] transition-all ${
                  settings.message === msg ? "bg-primary/10 text-primary border border-primary/20" : "text-muted-foreground hover:bg-surface-hover border border-transparent"
                }`}
              >
                {msg}
              </button>
            ))}
          </div>
        </div>

        {/* Schedule */}
        <div className="rounded-2xl glass border border-border/40 p-4">
          <p className="text-[9px] font-mono uppercase tracking-[0.15em] text-muted-foreground mb-3">When to reply</p>
          <div className="space-y-2">
            {([
              { id: "always", label: "Always", desc: "Reply to all messages 24/7" },
              { id: "outside_hours", label: "Outside work hours", desc: `Reply only before ${settings.startHour}:00 and after ${settings.endHour}:00` },
            ] as const).map((opt) => (
              <button
                key={opt.id}
                onClick={() => setSettings((s) => ({ ...s, schedule: opt.id }))}
                className={`w-full text-left rounded-xl px-3 py-2.5 transition-all ${
                  settings.schedule === opt.id ? "bg-primary/10 border border-primary/30" : "border border-border/30 hover:bg-surface-hover"
                }`}
              >
                <p className="text-xs font-medium text-foreground">{opt.label}</p>
                <p className="text-[10px] text-muted-foreground">{opt.desc}</p>
              </button>
            ))}
          </div>

          {settings.schedule === "outside_hours" && (
            <div className="grid grid-cols-2 gap-2 mt-3">
              <div>
                <label className="text-[9px] text-muted-foreground">Work starts</label>
                <select
                  value={settings.startHour}
                  onChange={(e) => setSettings((s) => ({ ...s, startHour: parseInt(e.target.value) }))}
                  className="w-full rounded-xl glass border border-border/50 px-2 py-1.5 text-xs text-foreground bg-transparent outline-none"
                >
                  {Array.from({ length: 24 }, (_, i) => <option key={i} value={i}>{i}:00</option>)}
                </select>
              </div>
              <div>
                <label className="text-[9px] text-muted-foreground">Work ends</label>
                <select
                  value={settings.endHour}
                  onChange={(e) => setSettings((s) => ({ ...s, endHour: parseInt(e.target.value) }))}
                  className="w-full rounded-xl glass border border-border/50 px-2 py-1.5 text-xs text-foreground bg-transparent outline-none"
                >
                  {Array.from({ length: 24 }, (_, i) => <option key={i} value={i}>{i}:00</option>)}
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Options */}
        <div className="rounded-2xl glass border border-border/40 p-4">
          <p className="text-[9px] font-mono uppercase tracking-[0.15em] text-muted-foreground mb-3">Options</p>
          <button
            onClick={() => setSettings((s) => ({ ...s, replyOnce: !s.replyOnce }))}
            className="flex items-center justify-between w-full"
          >
            <div>
              <p className="text-xs font-medium text-foreground text-left">Reply once per person</p>
              <p className="text-[10px] text-muted-foreground text-left">Don't spam — only reply to first message</p>
            </div>
            <div className={`w-9 h-5 rounded-full transition-all ${settings.replyOnce ? "bg-primary" : "bg-secondary"}`}>
              <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-all mt-0.5 ${settings.replyOnce ? "ml-4.5 translate-x-0.5" : "ml-0.5"}`} />
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}

// Hook to use in MeshProvider for auto-replying
export function getAutoReplySettings(): AutoReplySettings | null {
  try {
    const saved = localStorage.getItem("meshlink-autoreply");
    if (!saved) return null;
    const settings = JSON.parse(saved) as AutoReplySettings;
    if (!settings.enabled) return null;

    // Check schedule
    if (settings.schedule === "outside_hours") {
      const hour = new Date().getHours();
      if (hour >= settings.startHour && hour < settings.endHour) return null;
    }

    return settings;
  } catch { return null; }
}
