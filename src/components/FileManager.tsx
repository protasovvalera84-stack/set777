import { useState } from "react";
import { X, FileText, Download, Image, Film, Music, File, Search } from "lucide-react";
import { Message } from "@/data/mockData";

interface FileManagerProps {
  open: boolean;
  onClose: () => void;
  messages: Message[];
  chatName: string;
}

interface SharedFile {
  id: string;
  name: string;
  type: "image" | "video" | "audio" | "document";
  url: string;
  size: string;
  timestamp: string;
  sender: string;
}

export function FileManager({ open, onClose, messages, chatName }: FileManagerProps) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "image" | "video" | "audio" | "document">("all");

  if (!open) return null;

  // Extract files from messages
  const files: SharedFile[] = messages
    .filter((m) => m.media && m.media.length > 0)
    .flatMap((m) =>
      (m.media || []).map((media) => ({
        id: media.id,
        name: media.name,
        type: media.type === "image" ? "image" as const : media.type === "video" ? "video" as const : media.type === "audio" ? "audio" as const : "document" as const,
        url: media.url,
        size: media.size ? `${(media.size / 1024).toFixed(0)} KB` : "—",
        timestamp: m.timestamp,
        sender: m.senderId === "me" ? "You" : m.senderId,
      }))
    );

  const filtered = files
    .filter((f) => filter === "all" || f.type === filter)
    .filter((f) => !search || f.name.toLowerCase().includes(search.toLowerCase()));

  const getIcon = (type: string) => {
    switch (type) {
      case "image": return <Image className="h-4 w-4 text-green-400" />;
      case "video": return <Film className="h-4 w-4 text-blue-400" />;
      case "audio": return <Music className="h-4 w-4 text-purple-400" />;
      default: return <File className="h-4 w-4 text-muted-foreground" />;
    }
  };

  return (
    <div className="fixed inset-0 z-[55] flex flex-col bg-background animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border/40">
        <div>
          <h2 className="text-lg font-serif italic gradient-text">Files</h2>
          <p className="text-[11px] text-muted-foreground">{chatName} · {files.length} files</p>
        </div>
        <button onClick={onClose} className="rounded-xl p-2 hover:bg-surface-hover">
          <X className="h-5 w-5 text-muted-foreground" />
        </button>
      </div>

      {/* Search */}
      <div className="px-4 py-3 border-b border-border/30">
        <div className="flex items-center gap-2.5 rounded-2xl glass border border-border/50 px-4 py-2.5">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search files..."
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
          />
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 px-4 py-2 border-b border-border/20 overflow-x-auto">
        {(["all", "image", "video", "audio", "document"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-3 py-1.5 text-[10px] font-medium whitespace-nowrap transition-all ${
              filter === f ? "gradient-primary text-primary-foreground shadow-glow" : "text-muted-foreground hover:bg-surface-hover"
            }`}
          >
            {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}s
          </button>
        ))}
      </div>

      {/* File list */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <FileText className="h-12 w-12 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">No files found</p>
          </div>
        ) : (
          <div className="space-y-1">
            {filtered.map((file) => (
              <div key={file.id} className="flex items-center gap-3 rounded-2xl px-3 py-2.5 hover:bg-surface-hover transition-all">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary/50 border border-border/30">
                  {getIcon(file.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground truncate">{file.name}</p>
                  <p className="text-[10px] text-muted-foreground">{file.sender} · {file.size} · {file.timestamp}</p>
                </div>
                <a href={file.url} download={file.name} className="p-2 rounded-xl hover:bg-primary/10">
                  <Download className="h-4 w-4 text-primary" />
                </a>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
