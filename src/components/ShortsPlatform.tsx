/**
 * Meshlink Shorts Platform — TikTok-style full page
 *
 * Layout: Left sidebar menu + vertical scroll feed
 * Tabs: For You (all public), Friends, Following
 * Features: vertical snap scroll, like, comment, share, upload
 */

import { useState, useRef, useEffect, useCallback, lazy, Suspense } from "react";
import {
  Home, Search, Users, Radio, Upload, User, MoreHorizontal,
  Heart, MessageCircle, Share2, Bookmark, Volume2, VolumeX,
  Play, Pause, Music, X, Plus, ChevronDown, Film,
} from "lucide-react";
import { useMesh } from "@/lib/MeshProvider";
import { uploadMedia, mxcToUrl } from "@/lib/meshClient";

/* ===== Types ===== */
interface ShortVideo {
  id: string;
  url: string;
  type: "image" | "video";
  caption: string;
  author: string;
  authorId: string;
  avatar: string;
  likes: number;
  comments: number;
  shares: number;
  liked: boolean;
  saved: boolean;
  visibility: "everyone" | "friends";
  timestamp: number;
}

interface ShortsPlatformProps {
  open: boolean;
  onClose: () => void;
}

const ROOM_ALIAS = "meshlink-shorts-v3";

/* ===== Main Platform ===== */
export function ShortsPlatform({ open, onClose }: ShortsPlatformProps) {
  const mesh = useMesh();
  const [tab, setTab] = useState<"foryou" | "friends" | "search">("foryou");
  const [videos, setVideos] = useState<ShortVideo[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [loading, setLoading] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [muted, setMuted] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Load shorts from server
  const loadShorts = useCallback(async () => {
    if (!mesh.client) return;
    setLoading(true);
    const baseUrl = mesh.client.getHomeserverUrl();
    const token = mesh.client.getAccessToken();
    const serverName = mesh.userId?.split(":")[1] || "";
    try {
      // Find or create room
      let roomId: string | null = null;
      const aliasResp = await fetch(`${baseUrl}/_matrix/client/v3/directory/room/${encodeURIComponent(`#${ROOM_ALIAS}:${serverName}`)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (aliasResp.ok) {
        roomId = ((await aliasResp.json()) as any).room_id;
        await fetch(`${baseUrl}/_matrix/client/v3/join/${encodeURIComponent(`#${ROOM_ALIAS}:${serverName}`)}`, {
          method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: "{}",
        }).catch(() => {});
      }
      if (!roomId) { setLoading(false); return; }

      const resp = await fetch(`${baseUrl}/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/messages?dir=b&limit=50`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) { setLoading(false); return; }
      const data = await resp.json() as any;
      const items: ShortVideo[] = [];
      for (const evt of (data.chunk || [])) {
        if (evt.type !== "org.meshlink.short_post") continue;
        const c = evt.content;
        const name = (evt.sender || "").split(":")[0].replace("@", "");
        items.push({
          id: evt.event_id,
          url: c.url || "",
          type: c.mediaType || "image",
          caption: c.caption || "",
          author: name,
          authorId: evt.sender || "",
          avatar: name.slice(0, 2).toUpperCase(),
          likes: 0, comments: 0, shares: 0,
          liked: false, saved: false,
          visibility: c.visibility || "everyone",
          timestamp: evt.origin_server_ts || 0,
        });
      }
      setVideos(items);
    } catch { /* ignore */ }
    setLoading(false);
  }, [mesh.client, mesh.userId]);

  useEffect(() => {
    if (open) loadShorts();
  }, [open, loadShorts]);

  // Filter by tab
  const filtered = videos.filter((v) => {
    if (tab === "friends") {
      return mesh.friends.includes(v.authorId) || v.authorId === mesh.userId;
    }
    if (tab === "search" && searchQuery) {
      return v.caption.toLowerCase().includes(searchQuery.toLowerCase()) || v.author.toLowerCase().includes(searchQuery.toLowerCase());
    }
    return v.visibility === "everyone" || v.authorId === mesh.userId;
  });

  // Scroll snap detection
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let timeout: ReturnType<typeof setTimeout>;
    const onScroll = () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        const idx = Math.round(el.scrollTop / el.clientHeight);
        if (idx !== currentIdx && idx >= 0 && idx < filtered.length) setCurrentIdx(idx);
      }, 100);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => { el.removeEventListener("scroll", onScroll); clearTimeout(timeout); };
  }, [currentIdx, filtered.length]);

  // Upload handler
  const handleUpload = async (file: File, caption: string, visibility: "everyone" | "friends") => {
    if (!mesh.client) return;
    const token = mesh.client.getAccessToken() || "";
    const baseUrl = mesh.client.getHomeserverUrl();
    const serverName = mesh.userId?.split(":")[1] || "";

    const mxcUri = await uploadMedia(token, file);
    const httpUrl = mxcToUrl(mxcUri);

    // Find room
    const aliasResp = await fetch(`${baseUrl}/_matrix/client/v3/directory/room/${encodeURIComponent(`#${ROOM_ALIAS}:${serverName}`)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    let roomId: string | null = null;
    if (aliasResp.ok) roomId = ((await aliasResp.json()) as any).room_id;
    if (!roomId) return;

    await fetch(`${baseUrl}/_matrix/client/v3/join/${encodeURIComponent(`#${ROOM_ALIAS}:${serverName}`)}`, {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: "{}",
    }).catch(() => {});

    const txn = `sp${Date.now()}.${Math.random().toString(36).slice(2, 5)}`;
    await fetch(`${baseUrl}/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/send/org.meshlink.short_post/${txn}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ url: httpUrl, mediaType: file.type.startsWith("video/") ? "video" : "image", caption, visibility }),
    });

    await loadShorts();
    setShowUpload(false);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[55] flex bg-black">
      {/* Left Sidebar (TikTok style) */}
      <div className="hidden md:flex w-[220px] flex-col bg-zinc-950 border-r border-white/5 py-4">
        {/* Logo */}
        <div className="px-4 mb-6">
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Film className="h-6 w-6 text-primary" /> Shorts
          </h1>
        </div>

        {/* Nav items */}
        <nav className="flex-1 space-y-1 px-2">
          {[
            { id: "foryou" as const, icon: Home, label: "For You" },
            { id: "search" as const, icon: Search, label: "Explore" },
            { id: "friends" as const, icon: Users, label: "Friends" },
          ].map((item) => (
            <button key={item.id} onClick={() => { setTab(item.id); setCurrentIdx(0); }}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all ${
                tab === item.id ? "bg-white/10 text-white font-semibold" : "text-white/60 hover:bg-white/5 hover:text-white"
              }`}>
              <item.icon className="h-5 w-5" /> {item.label}
            </button>
          ))}

          <div className="my-3 border-t border-white/10" />

          <button onClick={() => setShowUpload(true)}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm bg-primary text-primary-foreground font-semibold hover:opacity-90 transition-all">
            <Upload className="h-5 w-5" /> Upload
          </button>
        </nav>

        {/* Profile */}
        <div className="px-3 pt-3 border-t border-white/10">
          <button className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-white/60 hover:bg-white/5 hover:text-white transition-all">
            <div className="h-7 w-7 rounded-full bg-primary/30 flex items-center justify-center text-[9px] font-bold text-primary">
              {mesh.userId?.split(":")[0].replace("@", "").slice(0, 2).toUpperCase() || "ME"}
            </div>
            <span className="truncate">{mesh.userId?.split(":")[0].replace("@", "") || "Profile"}</span>
          </button>
          <button onClick={onClose} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 mt-1 text-sm text-white/40 hover:text-white/60 transition-all">
            <X className="h-4 w-4" /> Back to Meshlink
          </button>
        </div>
      </div>

      {/* Mobile top bar */}
      <div className="md:hidden absolute top-0 left-0 right-0 z-30 flex items-center justify-between px-4 py-3">
        <button onClick={onClose} className="p-1.5 rounded-full bg-black/40"><X className="h-5 w-5 text-white" /></button>
        <div className="flex gap-4">
          {(["foryou", "friends"] as const).map((t) => (
            <button key={t} onClick={() => { setTab(t); setCurrentIdx(0); }}
              className={`text-sm font-semibold ${tab === t ? "text-white" : "text-white/50"}`}>
              {t === "foryou" ? "For You" : "Friends"}
            </button>
          ))}
        </div>
        <button onClick={() => setShowUpload(true)} className="p-1.5 rounded-full bg-black/40"><Plus className="h-5 w-5 text-white" /></button>
      </div>

      {/* Search bar (when search tab active) */}
      {tab === "search" && (
        <div className="absolute top-16 left-0 right-0 md:left-[220px] z-20 px-4">
          <div className="flex items-center gap-2 rounded-full bg-white/10 border border-white/20 px-4 py-2.5 max-w-lg mx-auto">
            <Search className="h-4 w-4 text-white/50" />
            <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search shorts..." autoFocus
              className="flex-1 bg-transparent text-sm text-white placeholder:text-white/40 outline-none" />
          </div>
        </div>
      )}

      {/* Feed (vertical scroll snap) */}
      <div ref={containerRef} className="flex-1 overflow-y-scroll snap-y snap-mandatory scrollbar-none"
        style={{ scrollSnapType: "y mandatory" }}>
        {loading ? (
          <div className="h-full flex items-center justify-center">
            <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center gap-4">
            <Film className="h-16 w-16 text-white/20" />
            <p className="text-white/40 text-sm">{tab === "friends" ? "No shorts from friends yet" : tab === "search" ? "No results" : "No shorts yet"}</p>
            <button onClick={() => setShowUpload(true)} className="px-4 py-2 rounded-full bg-primary text-primary-foreground text-sm font-semibold">
              Upload first short
            </button>
          </div>
        ) : (
          filtered.map((video, idx) => (
            <div key={video.id} className="h-full w-full snap-start snap-always relative flex-shrink-0">
              <VideoSlide video={video} isActive={idx === currentIdx} muted={muted} onToggleMute={() => setMuted((m) => !m)} />
            </div>
          ))
        )}
      </div>

      {/* Upload dialog */}
      {showUpload && <UploadShortDialog onClose={() => setShowUpload(false)} onUpload={handleUpload} />}
    </div>
  );
}

/* ===== Single Video Slide ===== */
function VideoSlide({ video, isActive, muted, onToggleMute }: {
  video: ShortVideo; isActive: boolean; muted: boolean; onToggleMute: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [paused, setPaused] = useState(false);
  const [liked, setLiked] = useState(video.liked);
  const [likeCount, setLikeCount] = useState(video.likes);
  const [saved, setSaved] = useState(video.saved);
  const [heartAnim, setHeartAnim] = useState(false);
  const lastTapRef = useRef(0);

  // Auto-play/pause
  useEffect(() => {
    if (video.type !== "video" || !videoRef.current) return;
    if (isActive && !paused) { videoRef.current.play().catch(() => {}); videoRef.current.muted = muted; }
    else videoRef.current.pause();
  }, [isActive, paused, muted, video.type]);

  // Double tap to like
  const handleTap = () => {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      if (!liked) { setLiked(true); setLikeCount((c) => c + 1); }
      setHeartAnim(true);
      setTimeout(() => setHeartAnim(false), 800);
      lastTapRef.current = 0;
    } else {
      lastTapRef.current = now;
      setTimeout(() => { if (lastTapRef.current === now) setPaused((p) => !p); }, 300);
    }
  };

  return (
    <div className="h-full w-full relative bg-black" onClick={handleTap}>
      {/* Media */}
      {video.type === "video" ? (
        <video ref={videoRef} src={video.url} loop playsInline muted={muted} className="h-full w-full object-contain" />
      ) : (
        <img src={video.url} alt="" className="h-full w-full object-contain" draggable={false} />
      )}

      {/* Pause icon */}
      {paused && isActive && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <Play className="h-16 w-16 text-white/60" />
        </div>
      )}

      {/* Double-tap heart */}
      {heartAnim && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
          <Heart className="h-24 w-24 text-red-500 fill-red-500 animate-ping" />
        </div>
      )}

      {/* Right side actions (TikTok style) */}
      <div className="absolute right-3 bottom-32 md:bottom-24 z-10 flex flex-col items-center gap-5">
        {/* Avatar */}
        <div className="relative">
          <div className="h-12 w-12 rounded-full bg-white/20 border-2 border-white flex items-center justify-center text-xs font-bold text-white">
            {video.avatar}
          </div>
          <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 h-5 w-5 rounded-full bg-primary flex items-center justify-center">
            <Plus className="h-3 w-3 text-white" />
          </div>
        </div>

        {/* Like */}
        <button onClick={(e) => { e.stopPropagation(); setLiked(!liked); setLikeCount((c) => liked ? c - 1 : c + 1); }}
          className="flex flex-col items-center gap-0.5">
          <div className={`h-11 w-11 rounded-full flex items-center justify-center ${liked ? "bg-red-500/20" : "bg-black/30"}`}>
            <Heart className={`h-6 w-6 ${liked ? "text-red-500 fill-red-500" : "text-white"}`} />
          </div>
          <span className="text-[10px] text-white font-medium">{likeCount}</span>
        </button>

        {/* Comment */}
        <button onClick={(e) => e.stopPropagation()} className="flex flex-col items-center gap-0.5">
          <div className="h-11 w-11 rounded-full bg-black/30 flex items-center justify-center">
            <MessageCircle className="h-6 w-6 text-white" />
          </div>
          <span className="text-[10px] text-white font-medium">{video.comments}</span>
        </button>

        {/* Save */}
        <button onClick={(e) => { e.stopPropagation(); setSaved(!saved); }} className="flex flex-col items-center gap-0.5">
          <div className={`h-11 w-11 rounded-full flex items-center justify-center ${saved ? "bg-yellow-500/20" : "bg-black/30"}`}>
            <Bookmark className={`h-6 w-6 ${saved ? "text-yellow-400 fill-yellow-400" : "text-white"}`} />
          </div>
        </button>

        {/* Share */}
        <button onClick={(e) => e.stopPropagation()} className="flex flex-col items-center gap-0.5">
          <div className="h-11 w-11 rounded-full bg-black/30 flex items-center justify-center">
            <Share2 className="h-6 w-6 text-white" />
          </div>
        </button>

        {/* Sound */}
        <button onClick={(e) => { e.stopPropagation(); onToggleMute(); }} className="flex flex-col items-center">
          <div className="h-9 w-9 rounded-full bg-black/30 flex items-center justify-center">
            {muted ? <VolumeX className="h-4 w-4 text-white" /> : <Volume2 className="h-4 w-4 text-white" />}
          </div>
        </button>
      </div>

      {/* Bottom info */}
      <div className="absolute bottom-4 left-4 right-20 z-10">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-sm font-bold text-white">@{video.author}</span>
          <button className="px-2 py-0.5 rounded border border-white/40 text-[10px] text-white hover:bg-white/10">Follow</button>
        </div>
        {video.caption && <p className="text-xs text-white/90 line-clamp-2 mb-1">{video.caption}</p>}
        <div className="flex items-center gap-1.5 text-white/50">
          <Music className="h-3 w-3" />
          <span className="text-[10px]">Original sound — @{video.author}</span>
        </div>
      </div>
    </div>
  );
}

/* ===== Upload Dialog ===== */
function UploadShortDialog({ onClose, onUpload }: {
  onClose: () => void;
  onUpload: (file: File, caption: string, visibility: "everyone" | "friends") => Promise<void>;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [caption, setCaption] = useState("");
  const [visibility, setVisibility] = useState<"everyone" | "friends">("everyone");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm rounded-3xl bg-zinc-900 border border-white/10 p-6">
        <input ref={fileRef} type="file" accept="image/*,video/*" className="hidden" onChange={(e) => {
          const f = e.target.files?.[0]; if (!f) return;
          if (f.size > 50 * 1024 * 1024) { alert("Max 50MB"); return; }
          setFile(f); setPreview(URL.createObjectURL(f));
        }} />

        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-white">Upload Short</h3>
          <button onClick={onClose}><X className="h-5 w-5 text-white/50" /></button>
        </div>

        {preview ? (
          <div className="mb-4 relative rounded-2xl overflow-hidden">
            {file?.type.startsWith("video/") ? (
              <video src={preview} controls className="w-full h-48 object-cover" />
            ) : (
              <img src={preview} alt="" className="w-full h-48 object-cover" />
            )}
            <button onClick={() => { setFile(null); setPreview(""); }} className="absolute top-2 right-2 p-1 rounded-full bg-black/60">
              <X className="h-3 w-3 text-white" />
            </button>
          </div>
        ) : (
          <button onClick={() => fileRef.current?.click()}
            className="w-full mb-4 flex flex-col items-center gap-3 rounded-2xl border border-dashed border-white/20 py-10 hover:border-primary/50 transition-all">
            <Upload className="h-8 w-8 text-white/30" />
            <span className="text-sm text-white/40">Select video or photo</span>
          </button>
        )}

        <input type="text" value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Add caption..."
          className="w-full mb-4 rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm text-white placeholder:text-white/30 outline-none focus:border-primary/50" />

        <div className="flex gap-2 mb-4">
          {(["everyone", "friends"] as const).map((v) => (
            <button key={v} onClick={() => setVisibility(v)}
              className={`flex-1 rounded-xl py-2 text-xs font-medium transition-all ${
                visibility === v ? "bg-primary text-primary-foreground" : "bg-white/5 text-white/50 hover:bg-white/10"
              }`}>
              {v === "everyone" ? "Everyone" : "Friends Only"}
            </button>
          ))}
        </div>

        <button onClick={async () => { if (!file) return; setUploading(true); try { await onUpload(file, caption, visibility); } finally { setUploading(false); } }}
          disabled={!file || uploading}
          className={`w-full rounded-xl py-3 text-sm font-bold transition-all ${file && !uploading ? "bg-primary text-primary-foreground" : "bg-white/10 text-white/30"}`}>
          {uploading ? "Uploading..." : "Post"}
        </button>
      </div>
    </div>
  );
}
