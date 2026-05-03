import { useState } from "react";
import { X, Mic, MicOff, Volume2, Users, Plus, Hash } from "lucide-react";

interface VoiceChannel {
  id: string;
  name: string;
  participants: string[];
}

interface VoiceChannelsProps {
  open: boolean;
  onClose: () => void;
  chatName: string;
}

export function VoiceChannels({ open, onClose, chatName }: VoiceChannelsProps) {
  const [channels, setChannels] = useState<VoiceChannel[]>([
    { id: "general", name: "General", participants: [] },
    { id: "music", name: "Music", participants: [] },
    { id: "gaming", name: "Gaming", participants: [] },
  ]);
  const [joined, setJoined] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [newName, setNewName] = useState("");

  if (!open) return null;

  const joinChannel = (id: string) => {
    if (joined === id) { setJoined(null); return; }
    setChannels((prev) => prev.map((c) => ({
      ...c,
      participants: c.id === id ? [...c.participants, "You"] : c.participants.filter((p) => p !== "You"),
    })));
    setJoined(id);
  };

  const addChannel = () => {
    if (!newName.trim()) return;
    setChannels((prev) => [...prev, { id: `vc-${Date.now()}`, name: newName.trim(), participants: [] }]);
    setNewName("");
  };

  return (
    <div className="fixed inset-0 z-[55] flex flex-col bg-background animate-fade-in-up">
      <div className="flex items-center justify-between px-5 py-3 border-b border-border/40 glass-strong">
        <div>
          <h2 className="text-lg font-serif italic gradient-text">Voice Channels</h2>
          <p className="text-[11px] text-muted-foreground">{chatName}</p>
        </div>
        <button onClick={onClose} className="rounded-xl p-2 hover:bg-surface-hover">
          <X className="h-5 w-5 text-muted-foreground" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
        {channels.map((ch) => (
          <div key={ch.id} className={`rounded-2xl glass border p-3 ${joined === ch.id ? "border-primary/40 bg-primary/5" : "border-border/30"}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Volume2 className={`h-4 w-4 ${joined === ch.id ? "text-primary" : "text-muted-foreground"}`} />
                <p className="text-sm font-medium text-foreground">{ch.name}</p>
                {ch.participants.length > 0 && (
                  <span className="text-[9px] text-muted-foreground bg-secondary rounded-full px-1.5">{ch.participants.length}</span>
                )}
              </div>
              <button onClick={() => joinChannel(ch.id)} className={`rounded-xl px-3 py-1 text-[10px] font-medium ${joined === ch.id ? "bg-destructive/20 text-destructive" : "gradient-primary text-primary-foreground shadow-glow"}`}>
                {joined === ch.id ? "Leave" : "Join"}
              </button>
            </div>
            {ch.participants.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {ch.participants.map((p, i) => (
                  <span key={i} className="text-[10px] text-muted-foreground bg-secondary/50 rounded-full px-2 py-0.5">{p}</span>
                ))}
              </div>
            )}
          </div>
        ))}

        {/* Add channel */}
        <div className="flex items-center gap-2 mt-3">
          <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addChannel()} placeholder="New channel name..." className="flex-1 rounded-xl glass border border-border/50 px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground outline-none bg-transparent" />
          <button onClick={addChannel} className="rounded-xl p-2 gradient-primary text-primary-foreground shadow-glow">
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Controls (when joined) */}
      {joined && (
        <div className="border-t border-border/40 px-4 py-3 glass-strong">
          <div className="flex items-center justify-center gap-4">
            <button onClick={() => setIsMuted((m) => !m)} className={`flex h-12 w-12 items-center justify-center rounded-full ${isMuted ? "bg-destructive/20 text-destructive" : "bg-secondary text-foreground"}`}>
              {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
            </button>
            <button onClick={() => { setJoined(null); setChannels((prev) => prev.map((c) => ({ ...c, participants: c.participants.filter((p) => p !== "You") }))); }} className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive text-white">
              <X className="h-5 w-5" />
            </button>
          </div>
          <p className="text-[10px] text-muted-foreground text-center mt-2">Connected to: {channels.find((c) => c.id === joined)?.name}</p>
        </div>
      )}
    </div>
  );
}
