/**
 * Meshlink Video — VK Video / YouTube style video platform
 *
 * Features:
 * - Upload videos with title, description
 * - Video feed (latest from all users)
 * - Like / dislike / comment
 * - View count
 * - Video player with controls
 * - Categories/tags
 * - Search videos
 */

import { useState, useRef, useEffect } from "react";
import {
  X, Upload, Play, Heart, MessageCircle, Eye, Search,
  ThumbsUp, ThumbsDown, Share2, Clock, Film, Send, Trash2,
} from "lucide-react";
import { useMesh } from "@/lib/MeshProvider";
import { uploadMedia, mxcToUrl } from "@/lib/meshClient";

interface Video {
  id: string;
  title: string;
  description: string;
  url: string;
  thumbnail?: string;
  author: string;
  authorId: string;
  timestamp: string;
  views: number;
  likes: number;
  liked?: boolean;
  dislikes: number;
  comments: VideoComment[];
  duration?: string;
}

interface VideoComment {
  id: string;
  author: string;
  authorId: string;
  text: string;
  timestamp: string;
  likes: number;
}

interface VideoPageProps {
  open: boolean;
  onClose: () => void;
}

const ROOM_ALIAS = "meshlink-videos";

export function VideoPage({ open, onClose }: VideoPageProps) {
  const mesh = useMesh();
  const [videos, setVideos] = useState<Video[]>([]);
  const [search, setSearch] = useState("");
  const [showUpload, setShowUpload] = useState(false);
  const [playing, setPlaying] = useState<Video | null>(null);
  const [loading, setLoading] = useState(false);

  // Load videos from public room
  useEffect(() => {
    if (!open || !mesh.client) return;
    setLoading(true);
    loadVideos().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mesh.client]);

  const getVideoRoomId = async (): Promise<string | null> => {
    if (!mesh.client) return null;
    const baseUrl = mesh.client.getHomeserverUrl();
    const token = mesh.client.getAccessToken();
    const serverName = mesh.userId?.split(":")[1] || "";
    const fullAlias = `#${ROOM_ALIAS}:${serverName}`;

    try {
      const resp = await fetch(`${baseUrl}/_matrix/client/v3/directory/room/${encodeURIComponent(fullAlias)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (resp.ok) {
        const data = await resp.json() as any;
        const joinResp = await fetch(`${baseUrl}/_matrix/client/v3/join/${encodeURIComponent(fullAlias)}`, {
          method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: "{}",
        });
        if (joinResp.ok) return data.room_id;
        // Join failed — room not public, delete alias and recreate
        await fetch(`${baseUrl}/_matrix/client/v3/directory/room/${encodeURIComponent(fullAlias)}`, {
          method: "DELETE", headers: { Authorization: `Bearer ${token}` },
        }).catch(() => {});
      }
      // Create room
      const createResp = await fetch(`${baseUrl}/_matrix/client/v3/createRoom`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: "Meshlink Videos",
          preset: "public_chat",
          room_alias_name: ROOM_ALIAS,
          initial_state: [
            { type: "m.room.join_rules", content: { join_rule: "public" }, state_key: "" },
            { type: "m.room.history_visibility", content: { history_visibility: "world_readable" }, state_key: "" },
          ],
        }),
      });
      if (createResp.ok) {
        const newRoom = ((await createResp.json()) as any).room_id;
        await fetch(`${baseUrl}/_matrix/client/v3/rooms/${encodeURIComponent(newRoom)}/state/m.room.power_levels/`, {
          method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ events_default: 0, state_default: 50, users_default: 0 }),
        }).catch(() => {});
        return newRoom;
      }
    } catch { /* ignore */ }
    return null;
  };

  const loadVideos = async () => {
    const roomId = await getVideoRoomId();
    if (!roomId || !mesh.client) return;
    const baseUrl = mesh.client.getHomeserverUrl();
    const token = mesh.client.getAccessToken();
    try {
      const resp = await fetch(`${baseUrl}/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/messages?dir=b&limit=200`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) return;
      const data = await resp.json() as any;
      const vids: Video[] = [];
      // Collect likes and comments
      const likesMap = new Map<string, { count: number; myLike: boolean }>();
      const commentsMap = new Map<string, VideoComment[]>();
      for (const evt of (data.chunk || [])) {
        if (evt.type === "org.meshlink.video_like") {
          const c = evt.content;
          const existing = likesMap.get(c.video_id) || { count: 0, myLike: false };
          if (c.liked) existing.count++;
          if (evt.sender === mesh.userId) existing.myLike = c.liked;
          likesMap.set(c.video_id, existing);
        } else if (evt.type === "org.meshlink.video_comment") {
          const c = evt.content;
          const existing = commentsMap.get(c.video_id) || [];
          existing.push({
            id: evt.event_id,
            author: c.author || evt.sender?.split(":")[0].replace("@", "") || "User",
            authorId: evt.sender || "",
            text: c.text || "",
            timestamp: new Date(evt.origin_server_ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            likes: 0,
          });
          commentsMap.set(c.video_id, existing);
        }
      }
      for (const evt of (data.chunk || [])) {
        if (evt.type === "org.meshlink.video") {
          const c = evt.content;
          const likeData = likesMap.get(evt.event_id);
          const videoComments = commentsMap.get(evt.event_id) || [];
          vids.push({
            id: evt.event_id,
            title: c.title || "Untitled",
            description: c.description || "",
            url: c.url || "",
            thumbnail: c.thumbnail,
            author: c.author || evt.sender?.split(":")[0].replace("@", "") || "Unknown",
            authorId: evt.sender || "",
            timestamp: new Date(evt.origin_server_ts).toLocaleDateString(),
            views: c.views || 0,
            likes: likeData?.count || 0,
            liked: likeData?.myLike || false,
            dislikes: c.dislikes || 0,
            comments: videoComments,
            duration: c.duration,
          });
        }
      }
      setVideos(vids);
    } catch { /* ignore */ }
  };

  const handleUpload = async (title: string, description: string, file: File) => {
    if (!mesh.client) return;
    const token = mesh.client.getAccessToken() || "";
    const baseUrl = mesh.client.getHomeserverUrl();
    const roomId = await getVideoRoomId();
    if (!roomId) return;

    // Upload video file
    const mxcUri = await uploadMedia(token, file);
    const httpUrl = mxcToUrl(mxcUri);
    const userName = mesh.userId?.split(":")[0].replace("@", "") || "User";

    // Send video event
    const txn = `v${Date.now()}`;
    await fetch(`${baseUrl}/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/send/org.meshlink.video/${txn}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        title, description, url: httpUrl, author: userName,
        views: 0, likes: 0, dislikes: 0, comments: [],
      }),
    });

    await loadVideos();
    setShowUpload(false);
  };

  if (!open) return null;

  const filtered = search
    ? videos.filter((v) => v.title.toLowerCase().includes(search.toLowerCase()) || v.author.toLowerCase().includes(search.toLowerCase()))
    : videos;

  return (
    <div className="fixed inset-0 z-[55] flex flex-col bg-background animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border/40">
        <div className="flex items-center gap-2">
          <Film className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-serif italic gradient-text">Video</h2>
          <span className="text-[10px] text-muted-foreground">{videos.length} videos</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowUpload(true)} className="rounded-xl p-2 hover:bg-surface-hover" title="Upload">
            <Upload className="h-4 w-4 text-primary" />
          </button>
          <button onClick={onClose} className="rounded-xl p-2 hover:bg-surface-hover">
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="px-4 py-3">
        <div className="flex items-center gap-2.5 rounded-2xl glass border border-border/50 px-4 py-2.5">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search videos..." className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none" />
        </div>
      </div>

      {/* Video grid */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <Film className="h-12 w-12 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">{search ? "No videos found" : "No videos yet"}</p>
            <button onClick={() => setShowUpload(true)} className="text-xs text-primary hover:underline">Upload first video</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {filtered.map((video) => (
              <button key={video.id} onClick={() => setPlaying(video)}
                className="text-left rounded-2xl border border-border/40 overflow-hidden hover:border-primary/40 transition-all group">
                <div className="relative aspect-video bg-black flex items-center justify-center">
                  {video.url ? (
                    <video src={video.url} className="w-full h-full object-cover" preload="metadata" />
                  ) : (
                    <Film className="h-8 w-8 text-white/30" />
                  )}
                  <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                    <Play className="h-10 w-10 text-white/80 drop-shadow" />
                  </div>
                  {video.duration && (
                    <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/70 text-[9px] text-white font-mono">{video.duration}</span>
                  )}
                </div>
                <div className="p-3">
                  <p className="text-sm font-medium text-foreground line-clamp-2">{video.title}</p>
                  <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
                    <span>{video.author}</span>
                    <span>{video.views} views</span>
                    <span>{video.timestamp}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Video player */}
      {playing && (
        <VideoPlayer video={playing} onClose={() => setPlaying(null)} myUserId={mesh.userId || ""} />
      )}

      {/* Upload dialog */}
      {showUpload && (
        <UploadDialog onClose={() => setShowUpload(false)} onUpload={handleUpload} />
      )}
    </div>
  );
}

/* ===== Video Player ===== */
function VideoPlayer({ video, onClose, myUserId }: { video: Video; onClose: () => void; myUserId: string }) {
  const mesh = useMesh();
  const [liked, setLiked] = useState(video.liked || false);
  const [likeCount, setLikeCount] = useState(video.likes);
  const [commentText, setCommentText] = useState("");
  const [comments, setComments] = useState(video.comments);

  // Save like to server
  const handleLike = async () => {
    const newLiked = !liked;
    setLiked(newLiked);
    setLikeCount((c) => newLiked ? c + 1 : c - 1);
    // Persist via reaction event on the video's event ID
    if (mesh.client && video.id) {
      const baseUrl = mesh.client.getHomeserverUrl();
      const token = mesh.client.getAccessToken();
      try {
        // Find video room
        const serverName = mesh.userId?.split(":")[1] || "";
        const aliasResp = await fetch(`${baseUrl}/_matrix/client/v3/directory/room/${encodeURIComponent(`#meshlink-videos:${serverName}`)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (aliasResp.ok) {
          const { room_id } = await aliasResp.json() as any;
          const txn = `vl${Date.now()}`;
          await fetch(`${baseUrl}/_matrix/client/v3/rooms/${encodeURIComponent(room_id)}/send/org.meshlink.video_like/${txn}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ video_id: video.id, liked: newLiked }),
          }).catch(() => {});
        }
      } catch { /* non-critical */ }
    }
  };

  // Save comment to server
  const handleComment = async () => {
    if (!commentText.trim()) return;
    const c: VideoComment = {
      id: `vc-${Date.now()}`,
      author: myUserId.split(":")[0].replace("@", "") || "You",
      authorId: myUserId,
      text: commentText.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      likes: 0,
    };
    setComments((prev) => [...prev, c]);
    setCommentText("");
    // Persist comment to server
    if (mesh.client) {
      const baseUrl = mesh.client.getHomeserverUrl();
      const token = mesh.client.getAccessToken();
      try {
        const serverName = mesh.userId?.split(":")[1] || "";
        const aliasResp = await fetch(`${baseUrl}/_matrix/client/v3/directory/room/${encodeURIComponent(`#meshlink-videos:${serverName}`)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (aliasResp.ok) {
          const { room_id } = await aliasResp.json() as any;
          const txn = `vc${Date.now()}`;
          await fetch(`${baseUrl}/_matrix/client/v3/rooms/${encodeURIComponent(room_id)}/send/org.meshlink.video_comment/${txn}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ video_id: video.id, text: c.text, author: c.author }),
          }).catch(() => {});
        }
      } catch { /* non-critical */ }
    }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-background flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/40">
        <h3 className="text-sm font-semibold text-foreground truncate flex-1">{video.title}</h3>
        <button onClick={onClose} className="rounded-xl p-2 hover:bg-surface-hover"><X className="h-5 w-5 text-muted-foreground" /></button>
      </div>

      {/* Video */}
      <div className="bg-black">
        <video src={video.url} controls autoPlay playsInline className="w-full max-h-[50vh] object-contain" />
      </div>

      {/* Info + actions */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-4 py-3 border-b border-border/30">
          <h2 className="text-base font-semibold text-foreground">{video.title}</h2>
          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><Eye className="h-3 w-3" /> {video.views}</span>
            <span>{video.timestamp}</span>
            <span>{video.author}</span>
          </div>
          {video.description && <p className="text-xs text-muted-foreground mt-2">{video.description}</p>}

          {/* Action buttons */}
          <div className="flex items-center gap-3 mt-3">
            <button onClick={handleLike}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all ${liked ? "bg-primary/10 text-primary" : "bg-secondary text-muted-foreground hover:bg-secondary/80"}`}>
              <ThumbsUp className={`h-3.5 w-3.5 ${liked ? "fill-current" : ""}`} /> {likeCount}
            </button>
            <button className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium bg-secondary text-muted-foreground hover:bg-secondary/80">
              <ThumbsDown className="h-3.5 w-3.5" /> {video.dislikes}
            </button>
            <button className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium bg-secondary text-muted-foreground hover:bg-secondary/80">
              <Share2 className="h-3.5 w-3.5" /> Share
            </button>
          </div>
        </div>

        {/* Comments */}
        <div className="px-4 py-3">
          <p className="text-xs font-semibold text-foreground mb-3">{comments.length} Comments</p>
          <div className="space-y-3">
            {comments.map((c) => (
              <div key={c.id} className="flex gap-2">
                <div className="h-7 w-7 rounded-full bg-secondary flex items-center justify-center text-[9px] font-bold text-foreground flex-shrink-0">
                  {c.author[0]?.toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-medium text-foreground">{c.author}</span>
                    <span className="text-[9px] text-muted-foreground">{c.timestamp}</span>
                  </div>
                  <p className="text-xs text-foreground/80 mt-0.5">{c.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Comment input */}
      <div className="flex items-center gap-2 px-4 py-3 border-t border-border/40">
        <input type="text" value={commentText} onChange={(e) => setCommentText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleComment()}
          placeholder="Add a comment..." className="flex-1 rounded-full bg-secondary border border-border/40 px-4 py-2 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50" />
        <button onClick={handleComment} disabled={!commentText.trim()} className="p-2 rounded-full bg-primary disabled:bg-secondary">
          <Send className="h-3.5 w-3.5 text-primary-foreground" />
        </button>
      </div>
    </div>
  );
}

/* ===== Upload Dialog ===== */
function UploadDialog({ onClose, onUpload }: { onClose: () => void; onUpload: (title: string, desc: string, file: File) => Promise<void> }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
    if (!title) setTitle(f.name.replace(/\.[^.]+$/, ""));
  };

  const handleSubmit = async () => {
    if (!file || !title.trim()) return;
    setUploading(true);
    try { await onUpload(title.trim(), description.trim(), file); }
    finally { setUploading(false); }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-background/70 backdrop-blur-sm" />
      <div onClick={(e) => e.stopPropagation()} className="relative w-full max-w-md rounded-3xl glass-strong border border-border/60 shadow-elegant p-6">
        <input ref={fileRef} type="file" accept="video/*" className="hidden" onChange={handleFile} />
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-serif italic gradient-text">Upload Video</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-surface-hover"><X className="h-4 w-4 text-muted-foreground" /></button>
        </div>

        {preview ? (
          <div className="mb-4">
            <video src={preview} controls className="w-full h-40 object-cover rounded-2xl border border-border/40" />
            <button onClick={() => { setFile(null); setPreview(""); }} className="mt-1 text-xs text-destructive hover:underline">Remove</button>
          </div>
        ) : (
          <button onClick={() => fileRef.current?.click()}
            className="w-full mb-4 flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border/50 py-8 hover:border-primary/40 hover:bg-surface-hover transition-all">
            <Upload className="h-8 w-8 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Select video file</span>
          </button>
        )}

        <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Video title..."
          className="w-full mb-3 rounded-2xl glass border border-border/50 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 bg-transparent" />
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description (optional)..." rows={2}
          className="w-full mb-4 rounded-2xl glass border border-border/50 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 bg-transparent resize-none" />

        <button onClick={handleSubmit} disabled={!file || !title.trim() || uploading}
          className={`w-full rounded-2xl py-3 text-sm font-semibold transition-all ${file && title.trim() && !uploading ? "gradient-primary text-primary-foreground shadow-glow" : "bg-secondary text-muted-foreground cursor-not-allowed"}`}>
          {uploading ? "Uploading..." : "Upload Video"}
        </button>
      </div>
    </div>
  );
}
