import { useState } from "react";
import { X, Bot, Plus, Trash2, Copy, Code, Zap } from "lucide-react";

interface BotConfig {
  id: string;
  name: string;
  trigger: string;
  response: string;
  active: boolean;
}

interface BotApiPageProps {
  open: boolean;
  onClose: () => void;
}

export function BotApiPage({ open, onClose }: BotApiPageProps) {
  const [bots, setBots] = useState<BotConfig[]>(() => {
    try { return JSON.parse(localStorage.getItem("meshlink-bots") || "[]"); } catch { return []; }
  });
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newTrigger, setNewTrigger] = useState("");
  const [newResponse, setNewResponse] = useState("");

  const save = (updated: BotConfig[]) => {
    setBots(updated);
    localStorage.setItem("meshlink-bots", JSON.stringify(updated));
  };

  const addBot = () => {
    if (!newName.trim() || !newTrigger.trim() || !newResponse.trim()) return;
    save([...bots, {
      id: `bot-${Date.now()}`,
      name: newName.trim(),
      trigger: newTrigger.trim(),
      response: newResponse.trim(),
      active: true,
    }]);
    setNewName(""); setNewTrigger(""); setNewResponse(""); setShowAdd(false);
  };

  const toggleBot = (id: string) => save(bots.map((b) => b.id === id ? { ...b, active: !b.active } : b));
  const deleteBot = (id: string) => save(bots.filter((b) => b.id !== id));

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[55] flex flex-col bg-background animate-fade-in-up">
      <div className="flex items-center justify-between px-5 py-3 border-b border-border/40">
        <div>
          <h2 className="text-lg font-serif italic gradient-text">Bot API</h2>
          <p className="text-[11px] text-muted-foreground">{bots.length} bot{bots.length !== 1 ? "s" : ""} configured</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowAdd(true)} className="rounded-xl p-2 hover:bg-surface-hover">
            <Plus className="h-4 w-4 text-primary" />
          </button>
          <button onClick={onClose} className="rounded-xl p-2 hover:bg-surface-hover">
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {/* API Info */}
        <div className="rounded-2xl bg-primary/5 border border-primary/10 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Code className="h-4 w-4 text-primary" />
            <p className="text-xs font-medium text-foreground">Simple Bot Framework</p>
          </div>
          <p className="text-[11px] text-muted-foreground">Create bots that auto-respond to trigger words. Bots run locally and respond instantly.</p>
        </div>

        {/* Bot list */}
        {bots.map((bot) => (
          <div key={bot.id} className={`rounded-2xl glass border p-4 ${bot.active ? "border-primary/30" : "border-border/30 opacity-60"}`}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Bot className={`h-4 w-4 ${bot.active ? "text-primary" : "text-muted-foreground"}`} />
                <p className="text-sm font-medium text-foreground">{bot.name}</p>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => toggleBot(bot.id)} className={`rounded-lg px-2 py-0.5 text-[9px] ${bot.active ? "bg-online/20 text-online" : "bg-secondary text-muted-foreground"}`}>
                  {bot.active ? "Active" : "Off"}
                </button>
                <button onClick={() => deleteBot(bot.id)} className="p-1 hover:bg-destructive/10 rounded-lg">
                  <Trash2 className="h-3 w-3 text-destructive" />
                </button>
              </div>
            </div>
            <div className="space-y-1 text-[10px]">
              <p className="text-muted-foreground">Trigger: <code className="bg-secondary px-1 rounded">{bot.trigger}</code></p>
              <p className="text-muted-foreground">Response: <code className="bg-secondary px-1 rounded">{bot.response}</code></p>
            </div>
          </div>
        ))}

        {bots.length === 0 && !showAdd && (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Bot className="h-12 w-12 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">No bots yet</p>
            <button onClick={() => setShowAdd(true)} className="text-xs text-primary hover:underline">Create your first bot</button>
          </div>
        )}

        {/* Add bot form */}
        {showAdd && (
          <div className="rounded-2xl glass border border-primary/30 p-4 space-y-3">
            <p className="text-xs font-medium text-foreground">New Bot</p>
            <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Bot name (e.g. Greeter)" className="w-full rounded-xl glass border border-border/50 px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground outline-none bg-transparent" />
            <input type="text" value={newTrigger} onChange={(e) => setNewTrigger(e.target.value)} placeholder="Trigger word (e.g. !hello)" className="w-full rounded-xl glass border border-border/50 px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground outline-none bg-transparent" />
            <textarea value={newResponse} onChange={(e) => setNewResponse(e.target.value)} placeholder="Response text" rows={2} className="w-full rounded-xl glass border border-border/50 px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground outline-none bg-transparent resize-none" />
            <div className="flex gap-2">
              <button onClick={addBot} className="flex-1 rounded-xl py-2 text-xs gradient-primary text-primary-foreground shadow-glow">Create Bot</button>
              <button onClick={() => setShowAdd(false)} className="rounded-xl px-4 py-2 text-xs bg-secondary text-muted-foreground">Cancel</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
