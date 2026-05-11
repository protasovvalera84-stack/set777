/**
 * Meshlink Shorts — TikTok-style vertical video feed
 *
 * Inspired by TikTok, Instagram Reels, VK Clips, Likee.
 * All code written from scratch for Meshlink.
 *
 * Features:
 * - Vertical scroll-snap feed (swipe up/down)
 * - Full-screen immersive viewer
 * - Auto-play/pause based on visibility
 * - Double-tap to like (heart animation)
 * - Right-side action bar (like, comment, share, save, sound)
 * - Slide-up comments panel
 * - Progress bar for images (auto-advance)
 * - Hold to pause
 * - Reply to short (sends DM)
 * - Multi-file upload with text overlay
 * - View count + viewers list (own shorts)
 * - Keyboard: arrows, space, escape
 */

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import {
  Plus, X, Image, Film, Trash2, Send, Eye, Share2, Bookmark,
  Type, Heart, MessageCircle, Volume2, VolumeX, ChevronUp, ChevronDown,
  Music, Play, Users, Globe,
} from "lucide-react";

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
  likes?: number;
  liked?: boolean;
  comments?: ShortComment[];
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

/* ===== Main Component: Shorts Strip ===== */

export function ShortsBar({ shorts, myUserId, myName, myAvatar, myAvatarUrl, onAddShort, onDeleteShort, onReplyToShort, onShareShort }: ShortsBarProps) {
  const [feedOpen, setFeedOpen] = useState(false);
  const [feedStartIndex, setFeedStartIndex] = useState(0);
  const [addOpen, setAddOpen] = useState(false);

  const myShort = shorts.find((s) => s.userId === myUserId);
  const otherShorts = shorts.filter((s) => s.userId !== myUserId);

  // Flatten all items for the vertical feed
  const allItems = useMemo(() => {
    const items: { short: Short; item: ShortItem; itemIndex: number }[] = [];
    const ordered = [myShort, ...otherShorts].filter(Boolean) as Short[];
    for (const s of ordered) {
      for (let i = 0; i < s.items.length; i++) {
        items.push({ short: s, item: s.items[i], itemIndex: i });
      }
    }
    return items;
  }, [shorts, myShort, otherShorts]);

  const openFeed = (startIdx: number) => {
    setFeedStartIndex(startIdx);
    setFeedOpen(true);
  };

  return (
    <>
      {/* Horizontal strip (like TikTok stories row) */}
      <div className="flex items-center gap-2 px-4 py-2 overflow-x-auto scrollbar-thin border-b border-border/30">
        {/* My short — always shows + icon, click opens feed or add */}
        <button
          onClick={() => myShort && myShort.items.length > 0 ? openFeed(0) : setAddOpen(true)}
          className="flex-shrink-0 flex flex-col items-center gap-1 group"
        >
          <div className="relative">
            <div className={`h-14 w-14 rounded-xl overflow-hidden border-2 transition-all ${myShort && myShort.items.length > 0 ? "border-primary shadow-glow" : "border-border/50"}`}>
              {myAvatarUrl ? (
                <img src={myAvatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="h-full w-full bg-gradient-to-br from-primary/30 to-primary-glow/10 flex items-center justify-center text-sm font-bold text-primary">
                  {myAvatar}
                </div>
              )}
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 h-5 w-5 rounded-md bg-primary flex items-center justify-center border-2 border-card">
              <Plus className="h-3 w-3 text-primary-foreground" />
            </div>
          </div>
          <span className="text-[9px] text-muted-foreground truncate w-14 text-center">{myShort && myShort.items.length > 0 ? "My Short" : "Add"}</span>
        </button>

        {/* PUBLIC SHORTS — all public shorts from all users */}
        {allItems.filter((a) => a.item.visibility === "everyone" && a.short.userId !== myUserId).length > 0 && (
          <button
            onClick={() => {
              const publicIdx = allItems.findIndex((a) => a.item.visibility === "everyone" && a.short.userId !== myUserId);
              if (publicIdx >= 0) openFeed(publicIdx);
            }}
            className="flex-shrink-0 flex flex-col items-center gap-1"
          >
            <div className="h-14 w-14 rounded-xl overflow-hidden border-2 border-accent shadow-[0_0_12px_hsl(var(--accent)/0.4)] bg-gradient-to-br from-accent/30 to-primary/20 flex items-center justify-center">
              <Globe className="h-6 w-6 text-accent" />
            </div>
            <span className="text-[9px] text-accent font-medium truncate w-14 text-center">All Shorts</span>
          </button>
        )}

        {/* Add new (always visible when user has shorts) */}
        {myShort && myShort.items.length > 0 && (
          <button onClick={() => setAddOpen(true)} className="flex-shrink-0 flex flex-col items-center gap-1">
            <div className="h-14 w-14 rounded-xl border-2 border-dashed border-primary/40 hover:border-primary flex items-center justify-center transition-all hover:bg-primary/5">
              <Plus className="h-5 w-5 text-primary" />
            </div>
            <span className="text-[9px] text-primary">New</span>
          </button>
        )}

        {/* Other users' shorts */}
        {otherShorts.map((s) => {
          const globalIdx = allItems.findIndex((a) => a.short.id === s.id);
          return (
            <button key={s.id} onClick={() => openFeed(globalIdx >= 0 ? globalIdx : 0)} className="flex-shrink-0 flex flex-col items-center gap-1">
              <div className={`h-14 w-14 rounded-xl overflow-hidden border-2 transition-all ${s.viewed ? "border-border/50" : "border-primary shadow-glow"}`}>
                {s.items[0]?.type === "image" ? (
                  <img src={s.items[0].url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="h-full w-full bg-gradient-to-br from-primary/20 to-accent/10 flex items-center justify-center text-xs font-bold text-foreground">{s.avatar}</div>
                )}
              </div>
              <span className="text-[9px] text-muted-foreground truncate w-14 text-center">{s.userName}</span>
            </button>
          );
        })}

        {/* New button */}
        <button onClick={() => setAddOpen(true)} className="flex-shrink-0 flex flex-col items-center gap-1">
          <div className="h-14 w-14 rounded-xl border-2 border-dashed border-border/50 hover:border-primary/40 flex items-center justify-center transition-all hover:bg-surface-hover">
            <Plus className="h-5 w-5 text-muted-foreground" />
          </div>
          <span className="text-[9px] text-muted-foreground">New</span>
        </button>
      </div>

      {/* TikTok-style vertical feed */}
      {feedOpen && allItems.length > 0 && (
        <TikTokFeed
          items={allItems}
          startIndex={feedStartIndex}
          myUserId={myUserId}
          onClose={() => setFeedOpen(false)}
          onDelete={(shortId, itemId) => { onDeleteShort(shortId, itemId); }}
          onReply={onReplyToShort}
          onShare={onShareShort}
        />
      )}

      {/* Add dialog */}
      {addOpen && <AddShortDialog onClose={() => setAddOpen(false)} onAdd={(items) => { onAddShort(items); setAddOpen(false); }} />}
    </>
  );
}

/* ===== TikTok-style Vertical Feed ===== */

function TikTokFeed({ items, startIndex, myUserId, onClose, onDelete, onReply, onShare }: {
  items: { short: Short; item: ShortItem; itemIndex: number }[];
  startIndex: number;
  myUserId: string;
  onClose: () => void;
  onDelete: (shortId: string, itemId: string) => void;
  onReply?: (userId: string, text: string) => void;
  onShare?: (item: ShortItem) => void;
}) {
  const [currentIndex, setCurrentIndex] = useState(startIndex);
  const containerRef = useRef<HTMLDivElement>(null);

  // Scroll-snap to current index
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const child = el.children[currentIndex] as HTMLElement;
    if (child) child.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [currentIndex]);

  // Detect scroll-snap position
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let timeout: ReturnType<typeof setTimeout>;
    const handleScroll = () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        const scrollTop = el.scrollTop;
        const height = el.clientHeight;
        const idx = Math.round(scrollTop / height);
        if (idx !== currentIndex && idx >= 0 && idx < items.length) {
          setCurrentIndex(idx);
        }
      }, 100);
    };
    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => { el.removeEventListener("scroll", handleScroll); clearTimeout(timeout); };
  }, [currentIndex, items.length]);

  // Keyboard
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowDown" || e.key === "ArrowRight") setCurrentIndex((i) => Math.min(i + 1, items.length - 1));
      else if (e.key === "ArrowUp" || e.key === "ArrowLeft") setCurrentIndex((i) => Math.max(i - 1, 0));
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [items.length, onClose]);

  const current = items[currentIndex];
  if (!current) return null;

  return (
    <div className="fixed inset-0 z-[60] bg-black">
      {/* Close button */}
      <button onClick={onClose} className="absolute top-4 right-4 z-30 p-2 rounded-full bg-black/40 hover:bg-black/60">
        <X className="h-5 w-5 text-white" />
      </button>

      {/* Scroll-snap container */}
      <div ref={containerRef} className="h-full w-full overflow-y-scroll snap-y snap-mandatory scrollbar-none" style={{ scrollSnapType: "y mandatory" }}>
        {items.map((entry, idx) => (
          <div key={entry.item.id} className="h-full w-full snap-start snap-always relative flex-shrink-0" style={{ scrollSnapAlign: "start" }}>
            <ShortSlide
              entry={entry}
              isActive={idx === currentIndex}
              isMine={entry.short.userId === myUserId}
              onDelete={() => onDelete(entry.short.id, entry.item.id)}
              onReply={onReply ? (text: string) => onReply(entry.short.userId, text) : undefined}
              onShare={onShare ? () => onShare(entry.item) : undefined}
            />
          </div>
        ))}
      </div>

      {/* Navigation hints */}
      {currentIndex > 0 && (
        <button onClick={() => setCurrentIndex((i) => i - 1)} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[calc(50%+60px)] z-20 p-1 rounded-full bg-white/10 hover:bg-white/20 hidden md:block">
          <ChevronUp className="h-5 w-5 text-white" />
        </button>
      )}
      {currentIndex < items.length - 1 && (
        <button onClick={() => setCurrentIndex((i) => i + 1)} className="absolute bottom-20 left-1/2 -translate-x-1/2 z-20 p-1 rounded-full bg-white/10 hover:bg-white/20 hidden md:block animate-bounce">
          <ChevronDown className="h-5 w-5 text-white" />
        </button>
      )}
    </div>
  );
}

/* ===== Single Short Slide (TikTok card) ===== */

function ShortSlide({ entry, isActive, isMine, onDelete, onReply, onShare }: {
  entry: { short: Short; item: ShortItem; itemIndex: number };
  isActive: boolean;
  isMine: boolean;
  onDelete: () => void;
  onReply?: (text: string) => void;
  onShare?: () => void;
}) {
  const { short, item } = entry;
  const videoRef = useRef<HTMLVideoElement>(null);
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(false);
  const [liked, setLiked] = useState(item.liked || false);
  const [likeCount, setLikeCount] = useState(item.likes || 0);
  const [saved, setSaved] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [showViewers, setShowViewers] = useState(false);
  const [heartAnim, setHeartAnim] = useState(false);
  const [progress, setProgress] = useState(0);
  const [replyText, setReplyText] = useState("");
  const [comments, setComments] = useState<ShortComment[]>(item.comments || []);
  const holdRef = useRef(false);
  const lastTapRef = useRef(0);

  const IMAGE_DURATION = 6000;

  // Auto-play/pause video based on visibility
  useEffect(() => {
    if (item.type !== "video" || !videoRef.current) return;
    if (isActive && !paused) {
      videoRef.current.play().catch(() => {});
      videoRef.current.muted = muted;
    } else {
      videoRef.current.pause();
    }
  }, [isActive, paused, muted, item.type]);

  // Auto-advance for images
  useEffect(() => {
    if (item.type !== "image" || !isActive || paused) { setProgress(0); return; }
    const start = Date.now();
    const timer = setInterval(() => {
      if (holdRef.current) return;
      const pct = Math.min((Date.now() - start) / IMAGE_DURATION, 1);
      setProgress(pct);
      if (pct >= 1) clearInterval(timer);
    }, 50);
    return () => clearInterval(timer);
  }, [item.id, isActive, paused, item.type]);

  // Double-tap to like (TikTok signature feature)
  const handleTap = (e: React.MouseEvent | React.TouchEvent) => {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      // Double tap — like with heart animation
      if (!liked) {
        setLiked(true);
        setLikeCount((c) => c + 1);
      }
      setHeartAnim(true);
      setTimeout(() => setHeartAnim(false), 800);
      lastTapRef.current = 0;
    } else {
      lastTapRef.current = now;
      // Single tap — toggle pause (after 300ms if no second tap)
      setTimeout(() => {
        if (lastTapRef.current === now) {
          setPaused((p) => !p);
        }
      }, 300);
    }
  };

  // Hold to pause
  const handleHoldStart = () => { holdRef.current = true; setPaused(true); };
  const handleHoldEnd = () => { holdRef.current = false; setPaused(false); };

  const handleLike = () => {
    setLiked((l) => !l);
    setLikeCount((c) => liked ? c - 1 : c + 1);
  };

  const handleAddComment = (text: string) => {
    if (!text.trim()) return;
    const newComment: ShortComment = {
      id: `c-${Date.now()}`,
      userId: "me",
      userName: "You",
      text: text.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
    setComments((prev) => [...prev, newComment]);
  };

  return (
    <div className="h-full w-full relative bg-black overflow-hidden">
      {/* Media */}
      {item.type === "video" ? (
        <video
          ref={videoRef}
          src={item.url}
          loop
          playsInline
          muted={muted}
          className="h-full w-full object-contain"
          onClick={handleTap}
          onMouseDown={handleHoldStart}
          onMouseUp={handleHoldEnd}
          onTouchStart={handleHoldStart}
          onTouchEnd={handleHoldEnd}
        />
      ) : (
        <div
          className="h-full w-full flex items-center justify-center"
          onClick={handleTap}
          onMouseDown={handleHoldStart}
          onMouseUp={handleHoldEnd}
          onTouchStart={handleHoldStart}
          onTouchEnd={handleHoldEnd}
        >
          <img src={item.url} alt="" className="max-h-full max-w-full object-contain" draggable={false} />
        </div>
      )}

      {/* Image progress bar */}
      {item.type === "image" && isActive && (
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-white/20 z-20">
          <div className="h-full bg-white transition-none" style={{ width: `${progress * 100}%` }} />
        </div>
      )}

      {/* Pause overlay */}
      {paused && isActive && (
        <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
          <div className="h-16 w-16 rounded-full bg-black/40 flex items-center justify-center">
            <Play className="h-8 w-8 text-white ml-1" />
          </div>
        </div>
      )}

      {/* Double-tap heart animation */}
      {heartAnim && (
        <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
          <Heart className="h-24 w-24 text-red-500 fill-red-500 animate-ping" />
        </div>
      )}

      {/* Text overlay */}
      {item.textOverlay && (
        <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
          <p className="text-3xl font-bold text-white text-center px-8 drop-shadow-[0_2px_12px_rgba(0,0,0,0.9)]">{item.textOverlay}</p>
        </div>
      )}

      {/* Bottom info (author + caption + music) */}
      <div className="absolute bottom-4 left-4 right-20 z-20 pointer-events-none">
        <div className="flex items-center gap-2 mb-2">
          <div className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold text-white border border-white/30">
            {short.avatar}
          </div>
          <span className="text-sm font-semibold text-white drop-shadow">{short.userName}</span>
          {!isMine && (
            <button className="pointer-events-auto px-2 py-0.5 rounded-md border border-white/40 text-[10px] text-white hover:bg-white/10">Follow</button>
          )}
        </div>
        {item.caption && <p className="text-xs text-white/90 mb-1.5 drop-shadow line-clamp-2">{item.caption}</p>}
        <div className="flex items-center gap-1.5 text-white/60">
          <Music className="h-3 w-3" />
          <span className="text-[10px]">Original sound — {short.userName}</span>
        </div>
      </div>

      {/* Right-side action bar (TikTok style) */}
      <div className="absolute right-3 bottom-24 z-20 flex flex-col items-center gap-5">
        {/* Like */}
        <button onClick={handleLike} className="flex flex-col items-center gap-0.5">
          <div className={`h-11 w-11 rounded-full flex items-center justify-center ${liked ? "bg-red-500/20" : "bg-black/30"}`}>
            <Heart className={`h-6 w-6 ${liked ? "text-red-500 fill-red-500" : "text-white"}`} />
          </div>
          <span className="text-[10px] text-white font-medium">{likeCount}</span>
        </button>

        {/* Comments */}
        <button onClick={() => setShowComments(true)} className="flex flex-col items-center gap-0.5">
          <div className="h-11 w-11 rounded-full bg-black/30 flex items-center justify-center">
            <MessageCircle className="h-6 w-6 text-white" />
          </div>
          <span className="text-[10px] text-white font-medium">{comments.length}</span>
        </button>

        {/* Share */}
        {onShare && (
          <button onClick={onShare} className="flex flex-col items-center gap-0.5">
            <div className="h-11 w-11 rounded-full bg-black/30 flex items-center justify-center">
              <Share2 className="h-6 w-6 text-white" />
            </div>
            <span className="text-[10px] text-white font-medium">Share</span>
          </button>
        )}

        {/* Save */}
        <button onClick={() => setSaved((s) => !s)} className="flex flex-col items-center gap-0.5">
          <div className={`h-11 w-11 rounded-full flex items-center justify-center ${saved ? "bg-yellow-500/20" : "bg-black/30"}`}>
            <Bookmark className={`h-6 w-6 ${saved ? "text-yellow-400 fill-yellow-400" : "text-white"}`} />
          </div>
          <span className="text-[10px] text-white font-medium">{saved ? "Saved" : "Save"}</span>
        </button>

        {/* Sound toggle */}
        {item.type === "video" && (
          <button onClick={() => setMuted((m) => !m)} className="flex flex-col items-center gap-0.5">
            <div className="h-11 w-11 rounded-full bg-black/30 flex items-center justify-center">
              {muted ? <VolumeX className="h-5 w-5 text-white" /> : <Volume2 className="h-5 w-5 text-white" />}
            </div>
          </button>
        )}

        {/* Views (own shorts) */}
        {isMine && (
          <button onClick={() => setShowViewers((v) => !v)} className="flex flex-col items-center gap-0.5">
            <div className="h-11 w-11 rounded-full bg-black/30 flex items-center justify-center">
              <Eye className="h-5 w-5 text-white" />
            </div>
            <span className="text-[10px] text-white font-medium">{item.views || 0}</span>
          </button>
        )}

        {/* Delete (own) */}
        {isMine && (
          <button onClick={onDelete} className="flex flex-col items-center gap-0.5">
            <div className="h-11 w-11 rounded-full bg-black/30 flex items-center justify-center">
              <Trash2 className="h-5 w-5 text-white/70" />
            </div>
          </button>
        )}
      </div>

      {/* Viewers popup */}
      {showViewers && isMine && (
        <div className="absolute bottom-36 right-16 z-30 w-48 rounded-2xl bg-black/80 backdrop-blur-sm border border-white/10 p-3" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] text-white/60 font-mono uppercase">{item.views || 0} views</p>
            <button onClick={() => setShowViewers(false)}><X className="h-3 w-3 text-white/40" /></button>
          </div>
          {(item.viewers || []).length > 0 ? (
            <div className="space-y-1.5 max-h-32 overflow-y-auto">
              {(item.viewers || []).map((v, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="h-5 w-5 rounded-full bg-white/20 flex items-center justify-center text-[8px] text-white font-bold">{v[0]?.toUpperCase()}</div>
                  <span className="text-xs text-white/80">{v}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-white/40">No viewers yet</p>
          )}
        </div>
      )}

      {/* Reply input (non-own shorts) */}
      {onReply && !isMine && !showComments && (
        <div className="absolute bottom-4 left-4 right-20 z-20 flex items-center gap-2">
          <input
            type="text"
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && replyText.trim()) { onReply(replyText.trim()); setReplyText(""); } e.stopPropagation(); }}
            placeholder={`Reply to ${short.userName}...`}
            className="flex-1 rounded-full bg-white/10 border border-white/20 px-4 py-2 text-xs text-white placeholder:text-white/40 outline-none focus:border-white/40 backdrop-blur-sm"
          />
          <button onClick={() => { if (replyText.trim() && onReply) { onReply(replyText.trim()); setReplyText(""); } }} disabled={!replyText.trim()} className="p-2 rounded-full bg-primary disabled:bg-white/10">
            <Send className="h-3.5 w-3.5 text-primary-foreground" />
          </button>
        </div>
      )}

      {/* Comments panel (slide up, like TikTok) */}
      {showComments && (
        <CommentsPanel
          comments={comments}
          onClose={() => setShowComments(false)}
          onAdd={handleAddComment}
        />
      )}
    </div>
  );
}

/* ===== Comments Panel (TikTok slide-up) ===== */

function CommentsPanel({ comments, onClose, onAdd }: {
  comments: ShortComment[];
  onClose: () => void;
  onAdd: (text: string) => void;
}) {
  const [text, setText] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [comments.length]);

  return (
    <div className="absolute inset-0 z-30 flex flex-col justify-end" onClick={onClose}>
      <div className="bg-zinc-900 rounded-t-3xl max-h-[60%] flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <span className="text-sm font-semibold text-white">{comments.length} comments</span>
          <button onClick={onClose}><X className="h-5 w-5 text-white/60" /></button>
        </div>

        {/* Comments list */}
        <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
          {comments.length === 0 && (
            <p className="text-center text-sm text-white/30 py-8">No comments yet. Be the first!</p>
          )}
          {comments.map((c) => (
            <div key={c.id} className="flex gap-3">
              <div className="h-8 w-8 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0">
                {c.userName[0]?.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-white/80">{c.userName}</span>
                  <span className="text-[9px] text-white/30">{c.timestamp}</span>
                </div>
                <p className="text-sm text-white/90 mt-0.5">{c.text}</p>
                <div className="flex items-center gap-3 mt-1">
                  <button className="text-[10px] text-white/40 hover:text-white/60">Reply</button>
                  <button className="flex items-center gap-1 text-[10px] text-white/40 hover:text-white/60">
                    <Heart className="h-3 w-3" /> {c.likes || 0}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Input */}
        <div className="flex items-center gap-2 px-4 py-3 border-t border-white/10">
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && text.trim()) { onAdd(text.trim()); setText(""); } }}
            placeholder="Add a comment..."
            autoFocus
            className="flex-1 rounded-full bg-white/10 border border-white/20 px-4 py-2.5 text-sm text-white placeholder:text-white/40 outline-none focus:border-white/40"
          />
          <button onClick={() => { if (text.trim()) { onAdd(text.trim()); setText(""); } }} disabled={!text.trim()} className="p-2.5 rounded-full bg-primary disabled:bg-white/10">
            <Send className="h-4 w-4 text-primary-foreground" />
          </button>
        </div>
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
  const [visibility, setVisibility] = useState<"friends" | "everyone">("friends");
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
    setPreviews((prev) => { URL.revokeObjectURL(prev[idx].url); return prev.filter((_, i) => i !== idx); });
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
      visibility,
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
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-surface-hover"><X className="h-4 w-4 text-muted-foreground" /></button>
        </div>

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
                  {i === 0 && textOverlay && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <p className="text-sm font-bold text-white text-center px-2 drop-shadow-[0_1px_4px_rgba(0,0,0,0.8)]">{textOverlay}</p>
                    </div>
                  )}
                  <button onClick={() => removePreview(i)} className="absolute top-1 right-1 p-1 rounded-full bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity">
                    <X className="h-3 w-3 text-white" />
                  </button>
                  {p.type === "video" && <div className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-black/60 text-[8px] text-white">VIDEO</div>}
                </div>
              ))}
            </div>
            <button onClick={() => fileRef.current?.click()} className="mt-2 text-xs text-primary hover:underline">+ Add more</button>
          </div>
        ) : (
          <div className="mb-4 flex gap-2">
            <button onClick={() => { if (fileRef.current) { fileRef.current.accept = "image/*"; fileRef.current.click(); } }}
              className="flex-1 flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border/50 py-6 hover:border-primary/40 hover:bg-surface-hover transition-all">
              <Image className="h-6 w-6 text-muted-foreground" /><span className="text-xs text-muted-foreground">Photo</span>
            </button>
            <button onClick={() => { if (fileRef.current) { fileRef.current.accept = "video/*"; fileRef.current.click(); } }}
              className="flex-1 flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border/50 py-6 hover:border-primary/40 hover:bg-surface-hover transition-all">
              <Film className="h-6 w-6 text-muted-foreground" /><span className="text-xs text-muted-foreground">Video</span>
            </button>
          </div>
        )}

        {previews.length > 0 && (
          <div className="mb-3">
            <button onClick={() => setShowTextInput((v) => !v)} className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors">
              <Type className="h-3.5 w-3.5" /><span>{showTextInput ? "Hide text overlay" : "Add text overlay"}</span>
            </button>
            {showTextInput && (
              <input type="text" value={textOverlay} onChange={(e) => setTextOverlay(e.target.value)} placeholder="Text on image..."
                className="mt-2 w-full rounded-xl glass border border-border/50 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 bg-transparent" />
            )}
          </div>
        )}

        <div className="mb-4">
          <input type="text" value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Add a caption..."
            className="w-full rounded-2xl glass border border-border/50 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 bg-transparent" />
        </div>

        {/* Visibility selector */}
        <div className="mb-4">
          <p className="text-xs text-muted-foreground mb-2">Who can see this?</p>
          <div className="flex gap-2">
            <button onClick={() => setVisibility("friends")}
              className={`flex-1 flex items-center justify-center gap-2 rounded-2xl py-2.5 text-xs font-medium transition-all border ${
                visibility === "friends" ? "border-primary bg-primary/10 text-primary" : "border-border/50 text-muted-foreground hover:bg-surface-hover"
              }`}>
              <Users className="h-3.5 w-3.5" /> My Friends
            </button>
            <button onClick={() => setVisibility("everyone")}
              className={`flex-1 flex items-center justify-center gap-2 rounded-2xl py-2.5 text-xs font-medium transition-all border ${
                visibility === "everyone" ? "border-primary bg-primary/10 text-primary" : "border-border/50 text-muted-foreground hover:bg-surface-hover"
              }`}>
              <Globe className="h-3.5 w-3.5" /> Everyone
            </button>
          </div>
        </div>

        <button onClick={handleAdd} disabled={previews.length === 0}
          className={`w-full rounded-2xl py-3 text-sm font-semibold transition-all ${previews.length > 0 ? "gradient-primary text-primary-foreground shadow-glow hover:scale-[1.02]" : "bg-secondary text-muted-foreground cursor-not-allowed"}`}>
          Share Short {previews.length > 1 ? `(${previews.length} items)` : ""}
        </button>
      </div>
    </div>
  );
}
