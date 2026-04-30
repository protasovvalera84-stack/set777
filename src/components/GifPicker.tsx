import { useState, useEffect, useRef } from "react";
import { X, Search, Image } from "lucide-react";

interface GifPickerProps {
  open: boolean;
  onClose: () => void;
  onSelect: (gifUrl: string) => void;
}

interface GifResult {
  id: string;
  url: string;
  preview: string;
  width: number;
  height: number;
}

// Use Tenor's anonymous search (no API key needed for web embeds)
const TENOR_BASE = "https://tenor.googleapis.com/v2";
const TENOR_KEY = "AIzaSyAyimkuYQYF_FXVALexPuGQctUWRURdCYQ"; // Public web key (same as Google's public tenor key)

export function GifPicker({ open, onClose, onSelect }: GifPickerProps) {
  const [search, setSearch] = useState("");
  const [gifs, setGifs] = useState<GifResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [trending, setTrending] = useState<GifResult[]>([]);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load trending on open
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch(`${TENOR_BASE}/featured?key=${TENOR_KEY}&limit=20&media_filter=tinygif,gif`)
      .then((r) => r.json())
      .then((data) => {
        const results = (data.results || []).map((item: any) => ({
          id: item.id,
          url: item.media_formats?.gif?.url || item.media_formats?.tinygif?.url || "",
          preview: item.media_formats?.tinygif?.url || item.media_formats?.nanogif?.url || "",
          width: item.media_formats?.tinygif?.dims?.[0] || 200,
          height: item.media_formats?.tinygif?.dims?.[1] || 150,
        }));
        setTrending(results);
        if (!search) setGifs(results);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open]);

  // Search with debounce
  useEffect(() => {
    if (!open) return;
    if (!search.trim()) {
      setGifs(trending);
      return;
    }
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      setLoading(true);
      fetch(`${TENOR_BASE}/search?key=${TENOR_KEY}&q=${encodeURIComponent(search)}&limit=20&media_filter=tinygif,gif`)
        .then((r) => r.json())
        .then((data) => {
          const results = (data.results || []).map((item: any) => ({
            id: item.id,
            url: item.media_formats?.gif?.url || item.media_formats?.tinygif?.url || "",
            preview: item.media_formats?.tinygif?.url || item.media_formats?.nanogif?.url || "",
            width: item.media_formats?.tinygif?.dims?.[0] || 200,
            height: item.media_formats?.tinygif?.dims?.[1] || 150,
          }));
          setGifs(results);
        })
        .catch(() => setGifs([]))
        .finally(() => setLoading(false));
    }, 400);
    return () => { if (searchTimeout.current) clearTimeout(searchTimeout.current); };
  }, [search, open, trending]);

  if (!open) return null;

  return (
    <div className="absolute bottom-full left-0 right-0 mb-2 z-40 mx-4 md:mx-6 animate-fade-in-up">
      <div className="rounded-2xl glass-strong border border-border/60 shadow-elegant overflow-hidden max-w-md mx-auto">
        {/* Header */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border/30">
          <Search className="h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search GIFs..."
            className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground outline-none"
            autoFocus
          />
          <button onClick={onClose} className="p-1 hover:bg-surface-hover rounded-lg">
            <X className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </div>

        {/* GIF grid */}
        <div className="grid grid-cols-3 gap-1 p-2 max-h-56 overflow-y-auto scrollbar-thin">
          {loading && gifs.length === 0 && (
            <p className="col-span-3 text-center text-xs text-muted-foreground py-8 animate-pulse">Loading GIFs...</p>
          )}
          {gifs.map((gif) => (
            <button
              key={gif.id}
              onClick={() => onSelect(gif.url)}
              className="rounded-xl overflow-hidden hover:opacity-80 transition-opacity border border-border/20"
            >
              <img
                src={gif.preview || gif.url}
                alt="GIF"
                className="w-full h-20 object-cover"
                loading="lazy"
              />
            </button>
          ))}
          {!loading && gifs.length === 0 && search && (
            <p className="col-span-3 text-center text-xs text-muted-foreground py-8">No GIFs found</p>
          )}
        </div>

        {/* Powered by */}
        <div className="px-3 py-1 border-t border-border/20">
          <p className="text-[8px] text-muted-foreground/50 text-center">Powered by Tenor</p>
        </div>
      </div>
    </div>
  );
}
