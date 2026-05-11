import { useState, useRef, useEffect, useCallback } from "react";
import { Plus, X, Play, ChevronLeft, ChevronRight, Image, Film, Trash2, Send, Eye, Share2, Bookmark, Type, Pause } from "lucide-react";

export interface ShortItem {
  id: string;
  type: "image" | "video";
  url: string;
  caption?: string;
  textOverlay?: string;
  timestamp: string;
  views?: number;
  viewers?: string[];
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
  myAvatarUrl?: string | null;
  onAddShort: (items: ShortItem[]) => void;
  onDeleteShort: (shortId: string, itemId: string) => void;
  onReplyToShort?: (userId: string, text: string) => void;
  onShareShort?: (item: ShortItem) => void;
}

export function ShortsBar({ shorts, myUserId, myName, myAvatar, myAvatarUrl, onAddShort, onDeleteShort, onReplyToShort, onShareShort }: ShortsBarProps) {
  const [viewingShort, setViewingShort] = useState<Short | null>(null);
  const [viewingIndex, setViewingIndex] = useState(0);
  const [addOpen, setAddOpen] = useState(false);

  const myShort = shorts.find((s) => s.userId === myUserId);
  const otherShorts = shorts.filter((s) => s.userId !== myUserId);

  const allShorts = [myShort, ...otherShorts].filter(Boolean) as Short[];

  const handleNextShort = useCallback(() => {
    if (!viewingShort) return;
    if (viewingIndex < viewingShort.items.length - 1) {
      setViewingIndex((i) => i + 1);
    } else {
      const currentIdx = allShorts.findIndex((s) => s.id === viewingShort.id);
      if (currentIdx < allShorts.length - 1) {
        setViewingShort(allShorts[currentIdx + 1]);
        setViewingIndex(0);
      } else {
        setViewingShort(null);
      }
    }
  }, [viewingShort, viewingIndex, allShorts]);

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
              {myAvatarUrl ? (
                <img src={myAvatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="h-full w-full bg-gradient-to-br from-primary/30 to-primary-glow/10 flex items-center justify-center text-sm font-bold text-primary">
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

        {/* Add more button */}
        <button onClick={() => setAddOpen(true)} className="flex-shrink-0 flex flex-col items-center gap-1">
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
          onNext={handleNextShort}
          onPrev={() => { if (viewingIndex > 0) setViewingIndex((i) => i - 1); }}
          onDelete={(itemId) => {
            onDeleteShort(viewingShort.id, itemId);
            if (viewingShort.items.length <= 1) {
              setViewingShort(null);
            } else {
              setViewingIndex((i) => Math.min(i, viewingShort.items.length - 2));
            }
          }}
          onReply={onReplyToShort ? (text) => onReplyToShort(viewingShort.userId, text) : undefined}
          onShare={onShareShort}
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

/* ===== Short Viewer (fullscreen with auto-advance) ===== */
function ShortViewer({ short, index, isMine, onClose, onNext, onPrev, onDelete, onReply, onShare }: {
  short: Short;
  index: number;
  isMine: boolean;
  onClose: () => void;
  onNext: () => void;
  onPrev: () => void;
  onDelete: (itemId: string) => void;
  onReply?: (text: string) => void;
  onShare?: (item: ShortItem) => void;
}) {
  const item = short.items[index];
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const [replyText, setReplyText] = useState("");
  const [showViewers, setShowViewers] = useState(false);
  const [saved, setSaved] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const holdRef = useRef(false);

  const DURATION = item?.type === "video" ? 15000 : 6000; // 6s for images, 15s for video

  // Auto-advance timer
  useEffect(() => {
    if (!item || paused) return;
    setProgress(0);
    const startTime = Date.now();
    timerRef.current = setInterval(() => {
      if (holdRef.current) return; // paused by hold
      const elapsed = Date.now() - startTime;
      const pct = Math.min(elapsed / DURATION, 1);
      setProgress(pct);
      if (pct >= 1) {
        if (timerRef.current) clearInterval(timerRef.current);
        onNext();
      }
    }, 50);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [item?.id, index, paused, DURATION, onNext]);

  // Pause on hold (touch/mouse)
  const handleHoldStart = () => { holdRef.current = true; setPaused(true); };
  const handleHoldEnd = () => { holdRef.current = false; setPaused(false); };

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") onNext();
      else if (e.key === "ArrowLeft") onPrev();
      else if (e.key === "Escape") onClose();
      else if (e.key === " ") { e.preventDefault(); setPaused((p) => !p); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onNext, onPrev, onClose]);

  if (!item) return null;

  return (
    <div className="fixed inset-0 z-[60] bg-black flex flex-col">
      <div
        className="flex-1 flex items-center justify-center relative select-none"
        onMouseDown={handleHoldStart}
        onMouseUp={handleHoldEnd}
        onMouseLeave={handleHoldEnd}
        onTouchStart={handleHoldStart}
        onTouchEnd={handleHoldEnd}
      >
        {/* Progress bars with animation */}
        <div className="absolute top-3 left-3 right-3 flex gap-1 z-20">
          {short.items.map((_, i) => (
            <div key={i} className="flex-1 h-0.5 rounded-full bg-white/30 overflow-hidden">
              <div
                className="h-full rounded-full bg-white"
                style={{
                  width: i < index ? "100%" : i === index ? `${progress * 100}%` : "0%",
                  transition: i === index ? "none" : "width 0.3s",
                }}
              />
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
          <div className="flex items-center gap-1.5">
            {/* Pause indicator */}
            {paused && (
              <div className="p-1.5 rounded-lg bg-white/10">
                <Pause className="h-4 w-4 text-white" />
              </div>
            )}
            {isMine && (
              <button onClick={(e) => { e.stopPropagation(); onDelete(item.id); }} className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20">
                <Trash2 className="h-4 w-4 text-white" />
              </button>
            )}
            <button onClick={(e) => { e.stopPropagation(); onClose(); }} className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20">
              <X className="h-4 w-4 text-white" />
            </button>
          </div>
        </div>

        {/* Content */}
        {item.type === "image" ? (
          <img src={item.url} alt="" className="max-h-full max-w-full object-contain" draggable={false} />
        ) : (
          <video src={item.url} autoPlay muted={false} playsInline className="max-h-full max-w-full" />
        )}

        {/* Text overlay */}
        {item.textOverlay && (
          <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
            <p className="text-2xl font-bold text-white text-center px-8 drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]">
              {item.textOverlay}
            </p>
          </div>
        )}

        {/* Navigation areas (tap left/right) */}
        <div className="absolute left-0 top-0 bottom-0 w-1/3 cursor-pointer z-10" onClick={(e) => { e.stopPropagation(); onPrev(); }} />
        <div className="absolute right-0 top-0 bottom-0 w-1/3 cursor-pointer z-10" onClick={(e) => { e.stopPropagation(); onNext(); }} />

        {/* Caption */}
        {item.caption && (
          <div className="absolute bottom-32 left-4 right-4 z-20 pointer-events-none">
            <p className="text-sm text-white bg-black/50 rounded-xl px-3 py-2 backdrop-blur-sm">{item.caption}</p>
          </div>
        )}

        {/* Right side action buttons (like TikTok/Likee) */}
        <div className="absolute right-3 bottom-36 z-20 flex flex-col items-center gap-4">
          {/* Views count */}
          {isMine && (
            <button onClick={(e) => { e.stopPropagation(); setShowViewers((v) => !v); }} className="flex flex-col items-center gap-0.5">
              <div className="h-10 w-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20">
                <Eye className="h-5 w-5 text-white" />
              </div>
              <span className="text-[9px] text-white/70">{item.views || 0}</span>
            </button>
          )}
          {/* Share */}
          {onShare && (
            <button onClick={(e) => { e.stopPropagation(); onShare(item); }} className="flex flex-col items-center gap-0.5">
              <div className="h-10 w-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20">
                <Share2 className="h-5 w-5 text-white" />
              </div>
              <span className="text-[9px] text-white/70">Share</span>
            </button>
          )}
          {/* Save */}
          <button onClick={(e) => { e.stopPropagation(); setSaved((s) => !s); }} className="flex flex-col items-center gap-0.5">
            <div className={`h-10 w-10 rounded-full flex items-center justify-center ${saved ? "bg-primary" : "bg-white/10 hover:bg-white/20"}`}>
              <Bookmark className={`h-5 w-5 ${saved ? "text-primary-foreground fill-current" : "text-white"}`} />
            </div>
            <span className="text-[9px] text-white/70">{saved ? "Saved" : "Save"}</span>
          </button>
        </div>

        {/* Viewers list popup */}
        {showViewers && isMine && (
          <div className="absolute bottom-36 right-16 z-30 w-48 rounded-2xl bg-black/80 backdrop-blur-sm border border-white/10 p-3" onClick={(e) => e.stopPropagation()}>
            <p className="text-[10px] text-white/60 font-mono uppercase mb-2">{item.views || 0} views</p>
            {(item.viewers || []).length > 0 ? (
              <div className="space-y-1.5 max-h-32 overflow-y-auto">
                {(item.viewers || []).map((v, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="h-5 w-5 rounded-full bg-white/20 flex items-center justify-center text-[8px] text-white font-bold">
                      {v[0]?.toUpperCase()}
                    </div>
                    <span className="text-xs text-white/80">{v}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-white/40">No viewers yet</p>
            )}
          </div>
        )}

        {/* Reactions bar */}
        <div className="absolute bottom-20 left-4 right-16 z-20 flex items-center gap-2">
          {["❤️", "🔥", "😂", "😮", "👏", "😢"].map((emoji) => (
            <button
              key={emoji}
              onClick={(e) => { e.stopPropagation(); }}
              className="text-xl hover:scale-150 transition-transform p-1"
            >
              {emoji}
            </button>
          ))}
        </div>

        {/* Reply input (like Instagram) */}
        {onReply && !isMine && (
          <div className="absolute bottom-4 left-3 right-3 z-20 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
            <input
              type="text"
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && replyText.trim()) {
                  onReply(replyText.trim());
                  setReplyText("");
                }
                e.stopPropagation();
              }}
              onFocus={() => setPaused(true)}
              onBlur={() => setPaused(false)}
              placeholder={`Reply to ${short.userName}...`}
              className="flex-1 rounded-full bg-white/10 border border-white/20 px-4 py-2.5 text-sm text-white placeholder:text-white/40 outline-none focus:border-white/40 backdrop-blur-sm"
            />
            <button
              onClick={() => { if (replyText.trim() && onReply) { onReply(replyText.trim()); setReplyText(""); } }}
              disabled={!replyText.trim()}
              className="p-2.5 rounded-full bg-primary disabled:bg-white/10"
            >
              <Send className="h-4 w-4 text-primary-foreground" />
            </button>
          </div>
        )}

        {/* Nav arrows (desktop) */}
        {index > 0 && (
          <button onClick={(e) => { e.stopPropagation(); onPrev(); }} className="absolute left-2 top-1/2 -translate-y-1/2 z-20 p-1 rounded-full bg-white/10 hover:bg-white/20 hidden md:block">
            <ChevronLeft className="h-5 w-5 text-white" />
          </button>
        )}
        {index < short.items.length - 1 && (
          <button onClick={(e) => { e.stopPropagation(); onNext(); }} className="absolute right-2 top-1/2 -translate-y-1/2 z-20 p-1 rounded-full bg-white/10 hover:bg-white/20 hidden md:block">
            <ChevronRight className="h-5 w-5 text-white" />
          </button>
        )}
      </div>
    </div>
  );
}

/* ===== Add Short Dialog (multi-file + text overlay) ===== */
function AddShortDialog({ onClose, onAdd }: {
  onClose: () => void;
  onAdd: (items: ShortItem[]) => void;
}) {
  const [caption, setCaption] = useState("");
  const [textOverlay, setTextOverlay] = useState("");
  const [showTextInput, setShowTextInput] = useState(false);
  const [previews, setPreviews] = useState<{ url: string; type: "image" | "video"; file: File }[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    e.target.value = "";
    const newPreviews = files.map((file) => ({
      url: URL.createObjectURL(file),
      type: (file.type.startsWith("video/") ? "video" : "image") as "image" | "video",
      file,
    }));
    setPreviews((prev) => [...prev, ...newPreviews]);
  };

  const removePreview = (idx: number) => {
    setPreviews((prev) => {
      URL.revokeObjectURL(prev[idx].url);
      return prev.filter((_, i) => i !== idx);
    });
  };

  const handleAdd = () => {
    if (previews.length === 0) return;
    const items: ShortItem[] = previews.map((p, i) => ({
      id: `short-${Date.now()}-${i}`,
      type: p.type,
      url: p.url,
      caption: i === 0 ? caption.trim() || undefined : undefined,
      textOverlay: i === 0 && textOverlay.trim() ? textOverlay.trim() : undefined,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    }));
    onAdd(items);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in-up" onClick={onClose}>
      <div className="absolute inset-0 bg-background/70 backdrop-blur-sm" />
      <div onClick={(e) => e.stopPropagation()} className="relative w-full max-w-sm rounded-3xl glass-strong border border-border/60 shadow-elegant p-6 max-h-[90vh] overflow-y-auto">
        <input ref={fileRef} type="file" accept="image/*,video/*" multiple className="hidden" onChange={handleFiles} />

        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-serif italic gradient-text">New Short</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-surface-hover">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        {/* Preview grid */}
        {previews.length > 0 ? (
          <div className="mb-4">
            <div className={`grid gap-2 ${previews.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
              {previews.map((p, i) => (
                <div key={i} className="relative group">
                  {p.type === "image" ? (
                    <img src={p.url} alt="" className="w-full h-32 object-cover rounded-2xl border border-border/40" />
                  ) : (
                    <video src={p.url} className="w-full h-32 object-cover rounded-2xl border border-border/40" />
                  )}
                  {/* Text overlay preview */}
                  {i === 0 && textOverlay && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <p className="text-sm font-bold text-white text-center px-2 drop-shadow-[0_1px_4px_rgba(0,0,0,0.8)]">{textOverlay}</p>
                    </div>
                  )}
                  <button onClick={() => removePreview(i)} className="absolute top-1 right-1 p-1 rounded-full bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity">
                    <X className="h-3 w-3 text-white" />
                  </button>
                  {p.type === "video" && (
                    <div className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-black/60 text-[8px] text-white">VIDEO</div>
                  )}
                </div>
              ))}
            </div>
            {/* Add more media */}
            <button onClick={() => fileRef.current?.click()} className="mt-2 text-xs text-primary hover:underline">+ Add more</button>
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

        {/* Text overlay toggle */}
        {previews.length > 0 && (
          <div className="mb-3">
            <button onClick={() => setShowTextInput((v) => !v)} className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors">
              <Type className="h-3.5 w-3.5" />
              <span>{showTextInput ? "Hide text overlay" : "Add text overlay"}</span>
            </button>
            {showTextInput && (
              <input
                type="text"
                value={textOverlay}
                onChange={(e) => setTextOverlay(e.target.value)}
                placeholder="Text on image..."
                className="mt-2 w-full rounded-xl glass border border-border/50 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 bg-transparent"
              />
            )}
          </div>
        )}

        {/* Caption */}
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
          disabled={previews.length === 0}
          className={`w-full rounded-2xl py-3 text-sm font-semibold transition-all ${
            previews.length > 0 ? "gradient-primary text-primary-foreground shadow-glow hover:scale-[1.02]" : "bg-secondary text-muted-foreground cursor-not-allowed"
          }`}
        >
          Share Short {previews.length > 1 ? `(${previews.length} items)` : ""}
        </button>
      </div>
    </div>
  );
}
