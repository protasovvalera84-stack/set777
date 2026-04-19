import { useState } from "react";
import { Plus, Hash, MessageSquare, X, ChevronRight, Pencil, Trash2 } from "lucide-react";
import { Topic } from "@/data/mockData";

interface TopicsBarProps {
  topics: Topic[];
  activeTopic: string | null;
  onSelectTopic: (id: string | null) => void;
  onCreateTopic: (name: string, icon: string) => void;
  onDeleteTopic: (id: string) => void;
}

const TOPIC_ICONS = ["#", "📢", "💡", "🔧", "🎨", "📊", "🚀", "❓", "📝", "🔒"];

export function TopicsBar({ topics, activeTopic, onSelectTopic, onCreateTopic, onDeleteTopic }: TopicsBarProps) {
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newIcon, setNewIcon] = useState("#");

  const handleCreate = () => {
    if (!newName.trim()) return;
    onCreateTopic(newName.trim(), newIcon);
    setNewName("");
    setNewIcon("#");
    setCreateOpen(false);
  };

  return (
    <>
      {/* Topics strip */}
      <div className="relative z-10 flex items-center gap-1.5 px-4 py-2 border-b border-border/30 overflow-x-auto scrollbar-thin">
        {/* "All" button */}
        <button
          onClick={() => onSelectTopic(null)}
          className={`flex-shrink-0 flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[11px] font-medium transition-all ${
            activeTopic === null
              ? "gradient-primary text-primary-foreground shadow-glow"
              : "text-muted-foreground hover:bg-surface-hover"
          }`}
        >
          <MessageSquare className="h-3 w-3" />
          All
        </button>

        {topics.map((t) => (
          <button
            key={t.id}
            onClick={() => onSelectTopic(t.id)}
            className={`flex-shrink-0 group flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[11px] font-medium transition-all ${
              activeTopic === t.id
                ? "gradient-primary text-primary-foreground shadow-glow"
                : "text-muted-foreground hover:bg-surface-hover"
            }`}
          >
            <span>{t.icon}</span>
            {t.name}
            {t.messageCount > 0 && (
              <span className={`text-[9px] ${activeTopic === t.id ? "text-primary-foreground/70" : "text-muted-foreground/60"}`}>
                {t.messageCount}
              </span>
            )}
          </button>
        ))}

        {/* Add topic button */}
        <button
          onClick={() => setCreateOpen(true)}
          className="flex-shrink-0 flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground hover:text-primary hover:bg-surface-hover transition-all border border-dashed border-border/50 hover:border-primary/40"
        >
          <Plus className="h-3 w-3" />
        </button>
      </div>

      {/* Create topic dialog */}
      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in-up" onClick={() => setCreateOpen(false)}>
          <div className="absolute inset-0 bg-background/70 backdrop-blur-sm" />
          <div onClick={(e) => e.stopPropagation()} className="relative w-full max-w-sm rounded-3xl glass-strong border border-border/60 shadow-elegant p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-serif italic gradient-text">New Topic</h3>
              <button onClick={() => setCreateOpen(false)} className="rounded-lg p-1.5 hover:bg-surface-hover transition-colors">
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>

            {/* Icon picker */}
            <div className="mb-4">
              <label className="text-[10px] font-mono uppercase tracking-[0.15em] text-muted-foreground mb-2 block">Icon</label>
              <div className="flex flex-wrap gap-2">
                {TOPIC_ICONS.map((icon) => (
                  <button
                    key={icon}
                    onClick={() => setNewIcon(icon)}
                    className={`flex h-9 w-9 items-center justify-center rounded-xl text-base transition-all ${
                      newIcon === icon
                        ? "gradient-primary text-primary-foreground shadow-glow"
                        : "bg-secondary/60 hover:bg-surface-hover border border-border/50"
                    }`}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </div>

            {/* Name */}
            <div className="mb-4">
              <label className="text-[10px] font-mono uppercase tracking-[0.15em] text-muted-foreground mb-1.5 block">Topic name</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Design, Backend, Ideas..."
                autoFocus
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                className="w-full rounded-2xl glass border border-border/50 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 focus:shadow-glow transition-all bg-transparent"
              />
            </div>

            <button
              onClick={handleCreate}
              disabled={!newName.trim()}
              className={`w-full rounded-2xl py-3 text-sm font-semibold transition-all ${
                newName.trim()
                  ? "gradient-primary text-primary-foreground shadow-glow hover:scale-[1.02]"
                  : "bg-secondary text-muted-foreground cursor-not-allowed"
              }`}
            >
              Create Topic
            </button>
          </div>
        </div>
      )}
    </>
  );
}
