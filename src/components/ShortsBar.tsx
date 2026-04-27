import { useState, useRef } from "react";
import { Plus, X, Play, ChevronLeft, ChevronRight, Image, Film, Trash2 } from "lucide-react";

export interface ShortItem {
  id: string;
  type: "image" | "video";
  url: string;
  caption?: string;
  timestamp: string;
}

export interface Short {
  id: string;
  userId: string;
  userName: string;
  avatar: string;
  items: ShortItem[];
  viewed: boolean;
}

interface ShortsBarProps {
  shorts: Short[];
  myUserId: string;
  myName: string;
  myAvatar: string;
  onAddShort: (items: ShortItem[]) => void;
  onDeleteShort: (shortId: string, itemId: string) => void;
}

export function ShortsBar({ shorts, myUserId, myName, myAvatar, onAddShort, onDeleteShort }: ShortsBarProps) {
  const [viewingShort, setViewingShort] = useState<Short | null>(null);
  const [viewingIndex, setViewingIndex] = useState(0);
  const [addOpen, setAddOpen] = useState(false);

  const myShort = shorts.find((s) => s.userId === myUserId);
  const otherShorts = shorts.filter((s) => s.userId !== myUserId);

  return (
    <>
      {/* Shorts strip */}
      <div className="flex items-center gap-2 px-4 py-2 overflow-x-auto scrollbar-thin border-b border-border/30">
        {/* My short / Add button */}
        <button
          onClick={() => myShort ? setViewingShort(myShort) : setAddOpen(true)}
          className="flex-shrink-0 flex flex-col items-center gap-1 group"
        >
          <div className="relative">
            <div className={`h-14 w-14 rounded-xl overflow-hidden border-2 transition-all ${
              myShort ? "border-primary shadow-glow" : "border-border/50"
            }`}>
              {myShort && myShort.items.length > 0 ? (
                myShort.items[0].type === "image" ? (
                  <img src={myShort.items[0].url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="h-full w-full bg-gradient-to-br from-primary/30 to-accent/20 flex items-center justify-center">
                    <Play className="h-5 w-5 text-primary" />
                  </div>
                )
              ) : (
                <div className="h-full w-full bg-gradient-to-br from-secondary to-muted flex items-center justify-center text-xs font-bold text-foreground">
                  {myAvatar}
                </div>
              )}
            </div>
            {!myShort && (
              <div className="absolute -bottom-0.5 -right-0.5 h-5 w-5 rounded-md bg-primary flex items-center justify-center border-2 border-card">
                <Plus className="h-3 w-3 text-primary-foreground" />
              </div>
            )}
          </div>
          <span className="text-[9px] text-muted-foreground truncate w-14 text-center">
            {myShort ? "My Short" : "Add"}
          </span>
        </button>

        {/* Other users' shorts */}
        {otherShorts.map((s) => (
          <button
            key={s.id}
            onClick={() => { setViewingShort(s); setViewingIndex(0); }}
            className="flex-shrink-0 flex flex-col items-center gap-1"
          >
            <div className={`h-14 w-14 rounded-xl overflow-hidden border-2 transition-all ${
              s.viewed ? "border-border/50" : "border-primary shadow-glow"
            }`}>
              {s.items.length > 0 && s.items[0].type === "image" ? (
                <img src={s.items[0].url} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="h-full w-full bg-gradient-to-br from-primary/20 to-accent/10 flex items-center justify-center text-xs font-bold text-foreground">
                  {s.avatar}
                </div>
              )}
            </div>
            <span className="text-[9px] text-muted-foreground truncate w-14 text-center">{s.userName}</span>
          </button>
        ))}

        {/* Add more button (always visible) */}
        <button
          onClick={() => setAddOpen(true)}
          className="flex-shrink-0 flex flex-col items-center gap-1"
        >
          <div className="h-14 w-14 rounded-xl border-2 border-dashed border-border/50 hover:border-primary/40 flex items-center justify-center transition-all hover:bg-surface-hover">
            <Plus className="h-5 w-5 text-muted-foreground" />
          </div>
          <span className="text-[9px] text-muted-foreground">New</span>
        </button>
      </div>

      {/* View Short fullscreen */}
      {viewingShort && viewingShort.items.length > 0 && (
        <ShortViewer
          short={viewingShort}
          index={viewingIndex}
          isMine={viewingShort.userId === myUserId}
          onClose={() => setViewingShort(null)}
          onNext={() => {
            if (viewingIndex < viewingShort.items.length - 1) {
              setViewingIndex((i) => i + 1);
            } else {
              // Move to next user's short
              const allShorts = [myShort, ...otherShorts].filter(Boolean) as Short[];
              const currentIdx = allShorts.findIndex((s) => s.id === viewingShort.id);
              if (currentIdx < allShorts.length - 1) {
                setViewingShort(allShorts[currentIdx + 1]);
                setViewingIndex(0);
              } else {
                setViewingShort(null);
              }
            }
          }}
          onPrev={() => {
            if (viewingIndex > 0) setViewingIndex((i) => i - 1);
          }}
          onDelete={(itemId) => {
            onDeleteShort(viewingShort.id, itemId);
            if (viewingShort.items.length <= 1) {
              setViewingShort(null);
            } else {
              setViewingIndex((i) => Math.min(i, viewingShort.items.length - 2));
            }
          }}
        />
      )}

      {/* Add Short dialog */}
      {addOpen && (
        <AddShortDialog
          onClose={() => setAddOpen(false)}
          onAdd={(items) => { onAddShort(items); setAddOpen(false); }}
        />
      )}
    </>
  );
}

/* ===== Short Viewer (fullscreen) ===== */
function ShortViewer({ short, index, isMine, onClose, onNext, onPrev, onDelete }: {
  short: Short;
  index: number;
  isMine: boolean;
  onClose: () => void;
  onNext: () => void;
  onPrev: () => void;
  onDelete: (itemId: string) => void;
}) {
  const item = short.items[index];
  if (!item) return null;

  return (
    <div className="fixed inset-0 z-[60] bg-black flex flex-col" onClick={onClose}>
      <div className="flex-1 flex items-center justify-center relative" onClick={(e) => e.stopPropagation()}>
        {/* Progress bars */}
        <div className="absolute top-3 left-3 right-3 flex gap-1 z-20">
          {short.items.map((_, i) => (
            <div key={i} className="flex-1 h-0.5 rounded-full bg-white/30">
              <div className={`h-full rounded-full bg-white transition-all ${i <= index ? "w-full" : "w-0"}`} />
            </div>
          ))}
        </div>

        {/* Header */}
        <div className="absolute top-6 left-3 right-3 flex items-center justify-between z-20">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-white/20 flex items-center justify-center text-xs font-bold text-white">
              {short.avatar}
            </div>
            <div>
              <p className="text-xs font-semibold text-white">{short.userName}</p>
              <p className="text-[9px] text-white/60">{item.timestamp}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isMine && (
              <button onClick={() => onDelete(item.id)} className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20">
                <Trash2 className="h-4 w-4 text-white" />
              </button>
            )}
            <button onClick={onClose} className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20">
              <X className="h-4 w-4 text-white" />
            </button>
          </div>
        </div>

        {/* Content */}
        {item.type === "image" ? (
          <img src={item.url} alt="" className="max-h-full max-w-full object-contain" />
        ) : (
          <video src={item.url} controls autoPlay className="max-h-full max-w-full" />
        )}

        {/* Navigation areas */}
        <div className="absolute left-0 top-0 bottom-0 w-1/3 cursor-pointer z-10" onClick={(e) => { e.stopPropagation(); onPrev(); }} />
        <div className="absolute right-0 top-0 bottom-0 w-1/3 cursor-pointer z-10" onClick={(e) => { e.stopPropagation(); onNext(); }} />

        {/* Caption */}
        {item.caption && (
          <div className="absolute bottom-4 left-4 right-4 z-20">
            <p className="text-sm text-white bg-black/50 rounded-xl px-3 py-2 backdrop-blur-sm">{item.caption}</p>
          </div>
        )}

        {/* Nav arrows */}
        {index > 0 && (
          <button onClick={(e) => { e.stopPropagation(); onPrev(); }} className="absolute left-2 top-1/2 -translate-y-1/2 z-20 p-1 rounded-full bg-white/10 hover:bg-white/20">
            <ChevronLeft className="h-5 w-5 text-white" />
          </button>
        )}
        {index < short.items.length - 1 && (
          <button onClick={(e) => { e.stopPropagation(); onNext(); }} className="absolute right-2 top-1/2 -translate-y-1/2 z-20 p-1 rounded-full bg-white/10 hover:bg-white/20">
            <ChevronRight className="h-5 w-5 text-white" />
          </button>
        )}
      </div>
    </div>
  );
}

/* ===== Add Short Dialog ===== */
function AddShortDialog({ onClose, onAdd }: {
  onClose: () => void;
  onAdd: (items: ShortItem[]) => void;
}) {
  const [caption, setCaption] = useState("");
  const [preview, setPreview] = useState<{ url: string; type: "image" | "video"; file: File } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    const type = file.type.startsWith("video/") ? "video" as const : "image" as const;
    const url = URL.createObjectURL(file);
    setPreview({ url, type, file });
  };

  const handleAdd = () => {
    if (!preview) return;
    const item: ShortItem = {
      id: `short-${Date.now()}`,
      type: preview.type,
      url: preview.url,
      caption: caption.trim() || undefined,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
    onAdd([item]);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in-up" onClick={onClose}>
      <div className="absolute inset-0 bg-background/70 backdrop-blur-sm" />
      <div onClick={(e) => e.stopPropagation()} className="relative w-full max-w-sm rounded-3xl glass-strong border border-border/60 shadow-elegant p-6">
        <input ref={fileRef} type="file" accept="image/*,video/*" className="hidden" onChange={handleFile} />

        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-serif italic gradient-text">New Short</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-surface-hover">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        {preview ? (
          <div className="mb-4">
            {preview.type === "image" ? (
              <img src={preview.url} alt="" className="w-full h-48 object-cover rounded-2xl border border-border/40" />
            ) : (
              <video src={preview.url} controls className="w-full h-48 object-cover rounded-2xl border border-border/40" />
            )}
            <button onClick={() => setPreview(null)} className="mt-2 text-xs text-destructive hover:underline">Remove</button>
          </div>
        ) : (
          <div className="mb-4 flex gap-2">
            <button
              onClick={() => { if (fileRef.current) { fileRef.current.accept = "image/*"; fileRef.current.click(); } }}
              className="flex-1 flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border/50 py-6 hover:border-primary/40 hover:bg-surface-hover transition-all"
            >
              <Image className="h-6 w-6 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Photo</span>
            </button>
            <button
              onClick={() => { if (fileRef.current) { fileRef.current.accept = "video/*"; fileRef.current.click(); } }}
              className="flex-1 flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border/50 py-6 hover:border-primary/40 hover:bg-surface-hover transition-all"
            >
              <Film className="h-6 w-6 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Video</span>
            </button>
          </div>
        )}

        <div className="mb-4">
          <input
            type="text"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Add a caption..."
            className="w-full rounded-2xl glass border border-border/50 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 bg-transparent"
          />
        </div>

        <button
          onClick={handleAdd}
          disabled={!preview}
          className={`w-full rounded-2xl py-3 text-sm font-semibold transition-all ${
            preview ? "gradient-primary text-primary-foreground shadow-glow hover:scale-[1.02]" : "bg-secondary text-muted-foreground cursor-not-allowed"
          }`}
        >
          Share Short
        </button>
      </div>
    </div>
  );
}
