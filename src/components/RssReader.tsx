import { useState } from "react";
import { X, Plus, Rss, ExternalLink, Trash2, RefreshCw } from "lucide-react";

interface RssFeed {
  id: string;
  url: string;
  title: string;
  items: RssItem[];
}

interface RssItem {
  title: string;
  link: string;
  date: string;
}

interface RssReaderProps {
  open: boolean;
  onClose: () => void;
}

export function RssReader({ open, onClose }: RssReaderProps) {
  const [feeds, setFeeds] = useState<RssFeed[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("meshlink-rss") || "[]");
    } catch { return []; }
  });
  const [newUrl, setNewUrl] = useState("");
  const [loading, setLoading] = useState(false);

  const addFeed = async () => {
    if (!newUrl.trim()) return;
    setLoading(true);
    try {
      // Use a CORS proxy for RSS
      const proxyUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(newUrl.trim())}`;
      const resp = await fetch(proxyUrl);
      const data = await resp.json();

      if (data.status === "ok") {
        const feed: RssFeed = {
          id: `rss-${Date.now()}`,
          url: newUrl.trim(),
          title: data.feed?.title || newUrl.trim(),
          items: (data.items || []).slice(0, 10).map((item: any) => ({
            title: item.title || "Untitled",
            link: item.link || "",
            date: item.pubDate ? new Date(item.pubDate).toLocaleDateString() : "",
          })),
        };
        const updated = [...feeds, feed];
        setFeeds(updated);
        localStorage.setItem("meshlink-rss", JSON.stringify(updated));
        setNewUrl("");
      }
    } catch { /* failed to fetch */ }
    setLoading(false);
  };

  const removeFeed = (id: string) => {
    const updated = feeds.filter((f) => f.id !== id);
    setFeeds(updated);
    localStorage.setItem("meshlink-rss", JSON.stringify(updated));
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[55] flex flex-col bg-background animate-fade-in-up">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border/40">
        <div>
          <h2 className="text-lg font-serif italic gradient-text">RSS Reader</h2>
          <p className="text-[11px] text-muted-foreground">{feeds.length} feed{feeds.length !== 1 ? "s" : ""}</p>
        </div>
        <button onClick={onClose} className="rounded-xl p-2 hover:bg-surface-hover">
          <X className="h-5 w-5 text-muted-foreground" />
        </button>
      </div>

      {/* Add feed */}
      <div className="px-4 py-3 border-b border-border/30">
        <div className="flex items-center gap-2">
          <div className="flex-1 flex items-center gap-2 rounded-2xl glass border border-border/50 px-3 py-2">
            <Rss className="h-4 w-4 text-muted-foreground" />
            <input
              type="url"
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addFeed()}
              placeholder="Paste RSS feed URL..."
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
            />
          </div>
          <button onClick={addFeed} disabled={loading} className="rounded-xl p-2.5 gradient-primary text-primary-foreground shadow-glow">
            {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Feeds */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {feeds.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <Rss className="h-12 w-12 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">No RSS feeds yet</p>
            <p className="text-[10px] text-muted-foreground/60">Add a feed URL above to get started</p>
          </div>
        ) : (
          feeds.map((feed) => (
            <div key={feed.id} className="rounded-2xl glass border border-border/40 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/20">
                <div className="flex items-center gap-2">
                  <Rss className="h-3.5 w-3.5 text-primary" />
                  <p className="text-sm font-medium text-foreground truncate">{feed.title}</p>
                </div>
                <button onClick={() => removeFeed(feed.id)} className="p-1 hover:bg-destructive/10 rounded-lg">
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </button>
              </div>
              <div className="divide-y divide-border/20">
                {feed.items.map((item, i) => (
                  <a key={i} href={item.link} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-2 hover:bg-surface-hover transition-all">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-foreground truncate">{item.title}</p>
                      {item.date && <p className="text-[9px] text-muted-foreground">{item.date}</p>}
                    </div>
                    <ExternalLink className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                  </a>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
