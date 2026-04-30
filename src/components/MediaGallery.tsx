import { useState } from "react";
import { X, ChevronLeft, ChevronRight, Image, Film, Download } from "lucide-react";
import { Message, MediaAttachment } from "@/data/mockData";

interface MediaGalleryProps {
  open: boolean;
  onClose: () => void;
  messages: Message[];
  chatName: string;
}

interface MediaItem {
  id: string;
  url: string;
  type: "image" | "video" | "audio";
  name: string;
  timestamp: string;
  sender: string;
}

export function MediaGallery({ open, onClose, messages, chatName }: MediaGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [filter, setFilter] = useState<"all" | "image" | "video">("all");

  if (!open) return null;

  // Extract all media from messages
  const allMedia: MediaItem[] = messages
    .filter((m) => m.media && m.media.length > 0)
    .flatMap((m) =>
      (m.media || []).map((media) => ({
        id: media.id,
        url: media.url,
        type: media.type,
        name: media.name,
        timestamp: m.timestamp,
        sender: m.senderId === "me" ? "You" : m.senderId,
      }))
    );

  const filtered = filter === "all" ? allMedia : allMedia.filter((m) => m.type === filter);
  const selected = selectedIndex !== null ? filtered[selectedIndex] : null;

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-background animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border/40">
        <div>
          <h2 className="text-lg font-serif italic gradient-text">Media</h2>
          <p className="text-[11px] text-muted-foreground">{chatName} · {allMedia.length} files</p>
        </div>
        <button onClick={onClose} className="rounded-xl p-2 hover:bg-surface-hover">
          <X className="h-5 w-5 text-muted-foreground" />
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 px-5 py-3 border-b border-border/30">
        {(["all", "image", "video"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-3 py-1.5 text-[11px] font-medium transition-all ${
              filter === f ? "gradient-primary text-primary-foreground shadow-glow" : "text-muted-foreground hover:bg-surface-hover"
            }`}
          >
            {f === "all" ? `All (${allMedia.length})` : f === "image" ? `Photos (${allMedia.filter((m) => m.type === "image").length})` : `Videos (${allMedia.filter((m) => m.type === "video").length})`}
          </button>
        ))}
      </div>

      {/* Grid */}
      {selectedIndex === null ? (
        <div className="flex-1 overflow-y-auto p-4">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3">
              <Image className="h-12 w-12 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">No media in this chat</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 md:grid-cols-4 gap-1.5">
              {filtered.map((item, i) => (
                <button
                  key={item.id}
                  onClick={() => setSelectedIndex(i)}
                  className="relative aspect-square rounded-xl overflow-hidden border border-border/30 hover:opacity-80 transition-opacity group"
                >
                  {item.type === "image" ? (
                    <img src={item.url} alt={item.name} className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-primary/20 to-accent/10 flex items-center justify-center">
                      <Film className="h-8 w-8 text-primary/60" />
                    </div>
                  )}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <p className="text-[9px] text-white truncate">{item.timestamp}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* Full-screen viewer */
        <div className="flex-1 flex flex-col items-center justify-center bg-black relative">
          {selected && (
            <>
              {selected.type === "image" ? (
                <img src={selected.url} alt={selected.name} className="max-h-[80vh] max-w-full object-contain" />
              ) : (
                <video src={selected.url} controls autoPlay className="max-h-[80vh] max-w-full" />
              )}

              {/* Info bar */}
              <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-white/80">{selected.sender} · {selected.timestamp}</p>
                  <p className="text-[10px] text-white/50">{selected.name}</p>
                </div>
                <a href={selected.url} download={selected.name} className="p-2 rounded-xl bg-white/10 hover:bg-white/20">
                  <Download className="h-4 w-4 text-white" />
                </a>
              </div>

              {/* Navigation */}
              {selectedIndex > 0 && (
                <button onClick={() => setSelectedIndex(selectedIndex - 1)} className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/10 hover:bg-white/20">
                  <ChevronLeft className="h-5 w-5 text-white" />
                </button>
              )}
              {selectedIndex < filtered.length - 1 && (
                <button onClick={() => setSelectedIndex(selectedIndex + 1)} className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/10 hover:bg-white/20">
                  <ChevronRight className="h-5 w-5 text-white" />
                </button>
              )}

              {/* Back to grid */}
              <button onClick={() => setSelectedIndex(null)} className="absolute top-4 left-4 p-2 rounded-xl bg-white/10 hover:bg-white/20">
                <X className="h-4 w-4 text-white" />
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
