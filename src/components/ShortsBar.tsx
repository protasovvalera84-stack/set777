/**
 * Meshlink Stories — Telegram Stories style
 *
 * Architecture:
 * - Stories stored in public Matrix room #meshlink-shorts-v3
 * - Each story = org.meshlink.short_post event
 * - Media uploaded to Matrix media server (persistent HTTP URLs)
 * - Privacy: "everyone" (public feed) or "friends" (friends only)
 * - Stories shown as avatar rings in top bar (like Telegram)
 * - Full-screen viewer with progress bar, reactions, reply
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { Plus, X, Image, Film, Send, Heart, Eye, ChevronLeft, ChevronRight, Users, Globe, MessageCircle } from "lucide-react";

/* ===== Types ===== */

export interface ShortItem {
  id: string;
  type: "image" | "video";
  url: string;
  caption?: string;
  textOverlay?: string;
  timestamp: string;
  views?: number;
  viewers?: string[];
  visibility?: "friends" | "everyone";
}

export interface ShortComment {
  id: string;
  userId: string;
  userName: string;
  text: string;
  timestamp: string;
  likes?: number;
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

/* ===== Main: Story Strip (like Telegram top bar) ===== */

export function ShortsBar({ shorts, myUserId, myName, myAvatar, myAvatarUrl, onAddShort, onDeleteShort }: ShortsBarProps) {
  const [viewingShort, setViewingShort] = useState<Short | null>(null);
  const [viewingItemIdx, setViewingItemIdx] = useState(0);
  const [addOpen, setAddOpen] = useState(false);

  const myShort = shorts.find((s) => s.userId === myUserId);
  const otherShorts = shorts.filter((s) => s.userId !== myUserId);
  const allOrdered = [myShort, ...otherShorts].filter(Boolean) as Short[];

  // Navigate to next user's story
  const goNextUser = useCallback(() => {
    if (!viewingShort) return;
    const idx = allOrdered.findIndex((s) => s.id === viewingShort.id);
    if (idx < allOrdered.length - 1) {
      setViewingShort(allOrdered[idx + 1]);
      setViewingItemIdx(0);
    } else {
      setViewingShort(null);
    }
  }, [viewingShort, allOrdered]);

  // Navigate to prev user's story
  const goPrevUser = useCallback(() => {
    if (!viewingShort) return;
    const idx = allOrdered.findIndex((s) => s.id === viewingShort.id);
    if (idx > 0) {
      setViewingShort(allOrdered[idx - 1]);
      setViewingItemIdx(0);
    }
  }, [viewingShort, allOrdered]);

  return (
    <>
      {/* Story strip — avatars with colored ring (like Telegram) */}
      <div className="flex items-center gap-2 px-4 py-2 overflow-x-auto scrollbar-thin border-b border-border/30">
        {/* My story */}
        <button
          onClick={() => myShort && myShort.items.length > 0 ? (() => { setViewingShort(myShort); setViewingItemIdx(0); })() : setAddOpen(true)}
          className="flex-shrink-0 flex flex-col items-center gap-1"
        >
          <div className="relative">
            <div className={`h-14 w-14 rounded-full overflow-hidden border-[3px] transition-all ${
              myShort && myShort.items.length > 0 ? "border-primary" : "border-border/40"
            }`}>
              {myAvatarUrl ? (
                <img src={myAvatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="h-full w-full bg-gradient-to-br from-primary/30 to-primary-glow/10 flex items-center justify-center text-sm font-bold text-primary">
                  {myAvatar}
                </div>
              )}
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 h-5 w-5 rounded-full bg-primary flex items-center justify-center border-2 border-card">
              <Plus className="h-3 w-3 text-primary-foreground" />
            </div>
          </div>
          <span className="text-[9px] text-muted-foreground truncate w-14 text-center">My Story</span>
        </button>

        {/* Other users' stories */}
        {otherShorts.map((s) => (
          <button key={s.id} onClick={() => { setViewingShort(s); setViewingItemIdx(0); }}
            className="flex-shrink-0 flex flex-col items-center gap-1">
            <div className={`h-14 w-14 rounded-full overflow-hidden border-[3px] transition-all ${
              s.viewed ? "border-border/30" : "border-gradient-to-r from-primary to-accent border-primary"
            }`}>
              {s.items[0]?.type === "image" && s.items[0]?.url ? (
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
      </div>

      {/* Story Viewer (Telegram style) */}
      {viewingShort && viewingShort.items.length > 0 && (
        <StoryViewer
          short={viewingShort}
          itemIndex={viewingItemIdx}
          isMine={viewingShort.userId === myUserId}
          onClose={() => setViewingShort(null)}
          onNextItem={() => {
            if (viewingItemIdx < viewingShort.items.length - 1) {
              setViewingItemIdx((i) => i + 1);
            } else {
              goNextUser();
            }
          }}
          onPrevItem={() => {
            if (viewingItemIdx > 0) setViewingItemIdx((i) => i - 1);
            else goPrevUser();
          }}
          onDelete={(itemId) => {
            onDeleteShort(viewingShort.id, itemId);
            if (viewingShort.items.length <= 1) setViewingShort(null);
            else setViewingItemIdx((i) => Math.min(i, viewingShort.items.length - 2));
          }}
        />
      )}

      {/* Add Story Dialog */}
      {addOpen && (
        <AddStoryDialog onClose={() => setAddOpen(false)} onAdd={(items) => { onAddShort(items); setAddOpen(false); }} />
      )}
    </>
  );
}

/* ===== Story Viewer (Telegram style: progress bars, tap nav, auto-advance) ===== */

function StoryViewer({ short, itemIndex, isMine, onClose, onNextItem, onPrevItem, onDelete }: {
  short: Short;
  itemIndex: number;
  isMine: boolean;
  onClose: () => void;
  onNextItem: () => void;
  onPrevItem: () => void;
  onDelete: (itemId: string) => void;
}) {
  const item = short.items[itemIndex];
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const [replyText, setReplyText] = useState("");
  const holdRef = useRef(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const DURATION = item?.type === "video" ? 15000 : 5000;

  // Auto-advance timer
  useEffect(() => {
    if (!item || paused) return;
    setProgress(0);
    const start = Date.now();
    const timer = setInterval(() => {
      if (holdRef.current) return;
      const pct = Math.min((Date.now() - start) / DURATION, 1);
      setProgress(pct);
      if (pct >= 1) { clearInterval(timer); onNextItem(); }
    }, 50);
    return () => clearInterval(timer);
  }, [item?.id, itemIndex, paused, DURATION, onNextItem]);

  // Video auto-play
  useEffect(() => {
    if (item?.type === "video" && videoRef.current) {
      if (paused) videoRef.current.pause();
      else videoRef.current.play().catch(() => {});
    }
  }, [item, paused]);

  // Keyboard
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") onNextItem();
      else if (e.key === "ArrowLeft") onPrevItem();
      else if (e.key === " ") { e.preventDefault(); setPaused((p) => !p); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, onNextItem, onPrevItem]);

  const handleHoldStart = () => { holdRef.current = true; setPaused(true); };
  const handleHoldEnd = () => { holdRef.current = false; setPaused(false); };

  if (!item) return null;

  return (
    <div className="fixed inset-0 z-[60] bg-black flex items-center justify-center">
      {/* Story card (Telegram uses centered card on desktop) */}
      <div className="relative w-full h-full max-w-md max-h-[90vh] mx-auto bg-black rounded-none md:rounded-2xl overflow-hidden"
        onMouseDown={handleHoldStart} onMouseUp={handleHoldEnd} onMouseLeave={handleHoldEnd}
        onTouchStart={handleHoldStart} onTouchEnd={handleHoldEnd}>

        {/* Progress bars (top) */}
        <div className="absolute top-2 left-3 right-3 flex gap-1 z-30">
          {short.items.map((_, i) => (
            <div key={i} className="flex-1 h-[2px] rounded-full bg-white/30 overflow-hidden">
              <div className="h-full rounded-full bg-white" style={{
                width: i < itemIndex ? "100%" : i === itemIndex ? `${progress * 100}%` : "0%",
                transition: i === itemIndex ? "none" : "width 0.3s",
              }} />
            </div>
          ))}
        </div>

        {/* Header: avatar + name + time + close */}
        <div className="absolute top-5 left-3 right-3 flex items-center justify-between z-30">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center text-[10px] font-bold text-white border border-white/30">
              {short.avatar}
            </div>
            <div>
              <p className="text-xs font-semibold text-white">{short.userName}</p>
              <p className="text-[9px] text-white/50">{item.timestamp}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {item.visibility === "friends" && <Users className="h-3.5 w-3.5 text-white/50" />}
            {item.visibility === "everyone" && <Globe className="h-3.5 w-3.5 text-white/50" />}
            {isMine && (
              <button onClick={(e) => { e.stopPropagation(); onDelete(item.id); }} className="p-1.5 rounded-full bg-white/10 hover:bg-white/20">
                <X className="h-3.5 w-3.5 text-white" />
              </button>
            )}
            <button onClick={(e) => { e.stopPropagation(); onClose(); }} className="p-1.5 rounded-full bg-white/10 hover:bg-white/20">
              <X className="h-4 w-4 text-white" />
            </button>
          </div>
        </div>

        {/* Media content */}
        {item.type === "image" ? (
          <img src={item.url} alt="" className="h-full w-full object-contain" draggable={false} />
        ) : (
          <video ref={videoRef} src={item.url} loop playsInline muted={false} className="h-full w-full object-contain" />
        )}

        {/* Text overlay */}
        {item.textOverlay && (
          <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
            <p className="text-2xl font-bold text-white text-center px-8 drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]">{item.textOverlay}</p>
          </div>
        )}

        {/* Tap zones (left = prev, right = next) */}
        <div className="absolute left-0 top-0 bottom-0 w-1/3 z-20" onClick={(e) => { e.stopPropagation(); onPrevItem(); }} />
        <div className="absolute right-0 top-0 bottom-0 w-1/3 z-20" onClick={(e) => { e.stopPropagation(); onNextItem(); }} />

        {/* Caption (bottom) */}
        {item.caption && (
          <div className="absolute bottom-16 left-4 right-4 z-20 pointer-events-none">
            <p className="text-sm text-white bg-black/40 rounded-xl px-3 py-2 backdrop-blur-sm">{item.caption}</p>
          </div>
        )}

        {/* Bottom: reactions + reply (like Telegram) */}
        <div className="absolute bottom-3 left-3 right-3 z-20 flex items-center gap-2">
          {/* Quick reactions */}
          <div className="flex items-center gap-1">
            {["❤️", "🔥", "😂", "👏"].map((emoji) => (
              <button key={emoji} onClick={(e) => e.stopPropagation()} className="text-lg hover:scale-125 transition-transform">{emoji}</button>
            ))}
          </div>
          {/* Reply input */}
          {!isMine && (
            <div className="flex-1 flex items-center gap-1">
              <input type="text" value={replyText} onChange={(e) => setReplyText(e.target.value)}
                onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}
                onKeyDown={(e) => { if (e.key === "Enter" && replyText.trim()) { setReplyText(""); } e.stopPropagation(); }}
                placeholder="Reply..." onClick={(e) => e.stopPropagation()}
                className="flex-1 rounded-full bg-white/10 border border-white/20 px-3 py-1.5 text-xs text-white placeholder:text-white/40 outline-none" />
              <button onClick={(e) => { e.stopPropagation(); setReplyText(""); }}
                className="p-1.5 rounded-full bg-white/10"><Send className="h-3 w-3 text-white" /></button>
            </div>
          )}
          {/* Viewers count (own stories) */}
          {isMine && (
            <div className="flex-1 flex items-center justify-end gap-1 text-white/50">
              <Eye className="h-3.5 w-3.5" />
              <span className="text-[10px]">{item.views || 0} views</span>
            </div>
          )}
        </div>
      </div>

      {/* Desktop: prev/next arrows outside card */}
      <button onClick={onPrevItem} className="absolute left-4 top-1/2 -translate-y-1/2 z-30 p-2 rounded-full bg-white/10 hover:bg-white/20 hidden md:block">
        <ChevronLeft className="h-5 w-5 text-white" />
      </button>
      <button onClick={onNextItem} className="absolute right-4 top-1/2 -translate-y-1/2 z-30 p-2 rounded-full bg-white/10 hover:bg-white/20 hidden md:block">
        <ChevronRight className="h-5 w-5 text-white" />
      </button>
    </div>
  );
}

/* ===== Add Story Dialog (privacy selector: Friends / Everyone) ===== */

function AddStoryDialog({ onClose, onAdd }: {
  onClose: () => void;
  onAdd: (items: ShortItem[]) => void;
}) {
  const [caption, setCaption] = useState("");
  const [visibility, setVisibility] = useState<"friends" | "everyone">("friends");
  const [preview, setPreview] = useState<{ url: string; type: "image" | "video"; file: File } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    if (file.size > 50 * 1024 * 1024) { alert("File too large (max 50MB)"); return; }
    setPreview({ url: URL.createObjectURL(file), type: file.type.startsWith("video/") ? "video" : "image", file });
  };

  const handleAdd = () => {
    if (!preview) return;
    onAdd([{
      id: `s-${Date.now()}`,
      type: preview.type,
      url: preview.url,
      caption: caption.trim() || undefined,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      visibility,
    }]);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-background/70 backdrop-blur-sm" />
      <div onClick={(e) => e.stopPropagation()} className="relative w-full max-w-sm rounded-3xl glass-strong border border-border/60 shadow-elegant p-6">
        <input ref={fileRef} type="file" accept="image/*,video/*" className="hidden" onChange={handleFile} />

        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-serif italic gradient-text">New Story</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-surface-hover"><X className="h-4 w-4 text-muted-foreground" /></button>
        </div>

        {/* Media preview or picker */}
        {preview ? (
          <div className="mb-4 relative">
            {preview.type === "image" ? (
              <img src={preview.url} alt="" className="w-full h-48 object-cover rounded-2xl" />
            ) : (
              <video src={preview.url} controls className="w-full h-48 object-cover rounded-2xl" />
            )}
            <button onClick={() => { URL.revokeObjectURL(preview.url); setPreview(null); }}
              className="absolute top-2 right-2 p-1 rounded-full bg-black/60 hover:bg-black/80">
              <X className="h-3 w-3 text-white" />
            </button>
          </div>
        ) : (
          <div className="mb-4 flex gap-2">
            <button onClick={() => { if (fileRef.current) { fileRef.current.accept = "image/*"; fileRef.current.click(); } }}
              className="flex-1 flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border/50 py-8 hover:border-primary/40 hover:bg-surface-hover transition-all">
              <Image className="h-6 w-6 text-muted-foreground" /><span className="text-xs text-muted-foreground">Photo</span>
            </button>
            <button onClick={() => { if (fileRef.current) { fileRef.current.accept = "video/*"; fileRef.current.click(); } }}
              className="flex-1 flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border/50 py-8 hover:border-primary/40 hover:bg-surface-hover transition-all">
              <Film className="h-6 w-6 text-muted-foreground" /><span className="text-xs text-muted-foreground">Video</span>
            </button>
          </div>
        )}

        {/* Caption */}
        <input type="text" value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Add a caption..."
          className="w-full mb-4 rounded-2xl glass border border-border/50 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 bg-transparent" />

        {/* Privacy selector (like Telegram) */}
        <div className="mb-4">
          <p className="text-xs text-muted-foreground mb-2">Who can see this story?</p>
          <div className="flex gap-2">
            <button onClick={() => setVisibility("friends")}
              className={`flex-1 flex items-center justify-center gap-2 rounded-2xl py-2.5 text-xs font-medium transition-all border ${
                visibility === "friends" ? "border-primary bg-primary/10 text-primary" : "border-border/50 text-muted-foreground hover:bg-surface-hover"
              }`}>
              <Users className="h-3.5 w-3.5" /> Friends
            </button>
            <button onClick={() => setVisibility("everyone")}
              className={`flex-1 flex items-center justify-center gap-2 rounded-2xl py-2.5 text-xs font-medium transition-all border ${
                visibility === "everyone" ? "border-primary bg-primary/10 text-primary" : "border-border/50 text-muted-foreground hover:bg-surface-hover"
              }`}>
              <Globe className="h-3.5 w-3.5" /> Everyone
            </button>
          </div>
        </div>

        {/* Post button */}
        <button onClick={handleAdd} disabled={!preview}
          className={`w-full rounded-2xl py-3 text-sm font-semibold transition-all ${
            preview ? "gradient-primary text-primary-foreground shadow-glow hover:scale-[1.02]" : "bg-secondary text-muted-foreground cursor-not-allowed"
          }`}>
          Share Story
        </button>
      </div>
    </div>
  );
}
