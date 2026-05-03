import { useState } from "react";
import { X, Heart, MessageCircle, Share2, Plus, Image, Send } from "lucide-react";
import { useMesh } from "@/lib/MeshProvider";

interface Post {
  id: string;
  author: string;
  avatar: string;
  text: string;
  image?: string;
  likes: number;
  comments: number;
  time: string;
  liked: boolean;
}

interface FeedPageProps {
  open: boolean;
  onClose: () => void;
}

export function FeedPage({ open, onClose }: FeedPageProps) {
  const mesh = useMesh();
  const [posts, setPosts] = useState<Post[]>(() => {
    try { return JSON.parse(localStorage.getItem("meshlink-feed") || "[]"); } catch { return []; }
  });
  const [newPost, setNewPost] = useState("");
  const [showCompose, setShowCompose] = useState(false);

  const addPost = () => {
    if (!newPost.trim()) return;
    const post: Post = {
      id: `post-${Date.now()}`,
      author: mesh.userId?.split(":")[0].replace("@", "") || "You",
      avatar: (mesh.userId?.[1] || "M").toUpperCase(),
      text: newPost.trim(),
      likes: 0,
      comments: 0,
      time: new Date().toLocaleString(),
      liked: false,
    };
    const updated = [post, ...posts];
    setPosts(updated);
    localStorage.setItem("meshlink-feed", JSON.stringify(updated));
    setNewPost("");
    setShowCompose(false);
  };

  const toggleLike = (id: string) => {
    const updated = posts.map((p) => p.id === id ? { ...p, liked: !p.liked, likes: p.liked ? p.likes - 1 : p.likes + 1 } : p);
    setPosts(updated);
    localStorage.setItem("meshlink-feed", JSON.stringify(updated));
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[55] flex flex-col bg-background animate-fade-in-up">
      <div className="flex items-center justify-between px-5 py-3 border-b border-border/40 glass-strong">
        <h2 className="text-lg font-serif italic gradient-text">Feed</h2>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowCompose(true)} className="rounded-xl p-2 hover:bg-surface-hover">
            <Plus className="h-4 w-4 text-primary" />
          </button>
          <button onClick={onClose} className="rounded-xl p-2 hover:bg-surface-hover">
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* Compose */}
      {showCompose && (
        <div className="px-4 py-3 border-b border-border/30 glass">
          <textarea
            value={newPost}
            onChange={(e) => setNewPost(e.target.value)}
            placeholder="What's on your mind?"
            rows={3}
            autoFocus
            className="w-full rounded-xl glass border border-border/50 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 bg-transparent resize-none"
          />
          <div className="flex items-center justify-between mt-2">
            <button className="rounded-lg p-1.5 hover:bg-surface-hover">
              <Image className="h-4 w-4 text-muted-foreground" />
            </button>
            <button onClick={addPost} disabled={!newPost.trim()} className={`rounded-xl px-4 py-1.5 text-xs font-medium ${newPost.trim() ? "gradient-primary text-primary-foreground shadow-glow" : "bg-secondary text-muted-foreground"}`}>
              Post
            </button>
          </div>
        </div>
      )}

      {/* Posts */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {posts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <MessageCircle className="h-12 w-12 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">No posts yet</p>
            <button onClick={() => setShowCompose(true)} className="text-xs text-primary hover:underline">Create your first post</button>
          </div>
        ) : (
          <div className="divide-y divide-border/30">
            {posts.map((post) => (
              <div key={post.id} className="px-4 py-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-primary-glow/5 text-xs font-bold text-primary border border-primary/20">
                    {post.avatar}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{post.author}</p>
                    <p className="text-[10px] text-muted-foreground">{post.time}</p>
                  </div>
                </div>
                <p className="text-sm text-foreground whitespace-pre-line mb-3">{post.text}</p>
                <div className="flex items-center gap-4">
                  <button onClick={() => toggleLike(post.id)} className={`flex items-center gap-1 text-xs ${post.liked ? "text-red-400" : "text-muted-foreground"}`}>
                    <Heart className={`h-4 w-4 ${post.liked ? "fill-red-400" : ""}`} /> {post.likes}
                  </button>
                  <button className="flex items-center gap-1 text-xs text-muted-foreground">
                    <MessageCircle className="h-4 w-4" /> {post.comments}
                  </button>
                  <button className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Share2 className="h-4 w-4" /> Share
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
