import { useState, useRef } from "react";
import { X, Hash, Users, Image, Camera } from "lucide-react";
import { Chat } from "@/data/mockData";

interface CreateChatDialogProps {
  open: boolean;
  type: "group" | "channel";
  onClose: () => void;
  onCreate: (chat: Chat) => void;
}

function resizeImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const side = Math.min(img.width, img.height);
        const sx = (img.width - side) / 2;
        const sy = (img.height - side) / 2;
        canvas.width = 256;
        canvas.height = 256;
        const ctx = canvas.getContext("2d");
        if (!ctx) { reject(new Error("no ctx")); return; }
        ctx.drawImage(img, sx, sy, side, side, 0, 0, 256, 256);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.onerror = reject;
      img.src = reader.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function CreateChatDialog({ open, type, onClose, onCreate }: CreateChatDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  const handleAvatarPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    try {
      const url = await resizeImage(file);
      setAvatarUrl(url);
    } catch { /* ignore */ }
  };

  const handleCreate = () => {
    if (!name.trim()) return;

    const initials = name
      .split(" ")
      .map((w) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);

    const newChat: Chat = {
      id: `chat-${Date.now()}`,
      name: type === "channel" ? `# ${name.trim()}` : name.trim(),
      avatar: initials || "??",
      avatarUrl,
      type,
      lastMessage: description.trim() || "Chat created",
      lastMessageTime: "now",
      unread: 0,
      members: 1,
      memberIds: ["me"],
      topics: type === "group" ? [{ id: "general", name: "General", icon: "#", messageCount: 0, lastMessage: "Topic created", lastMessageTime: "now" }] : undefined,
      messages: [
        {
          id: `msg-${Date.now()}`,
          senderId: "system",
          text: description.trim()
            ? `${type === "channel" ? "Channel" : "Group"} created\n\n${description.trim()}`
            : `${type === "channel" ? "Channel" : "Group"} "${name.trim()}" created. Start sharing!`,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          read: true,
        },
      ],
    };

    onCreate(newChat);
    setName("");
    setDescription("");
    setAvatarUrl(null);
    onClose();
  };

  const handleClose = () => {
    setName("");
    setDescription("");
    setAvatarUrl(null);
    onClose();
  };

  const isChannel = type === "channel";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in-up" onClick={handleClose}>
      <div className="absolute inset-0 bg-background/70 backdrop-blur-sm" />
      <div onClick={(e) => e.stopPropagation()} className="relative w-full max-w-md rounded-3xl glass-strong border border-border/60 shadow-elegant p-6">
        {/* File input inside dialog */}
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarPick} />

        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-serif italic gradient-text">
            {isChannel ? "New Channel" : "New Group"}
          </h2>
          <button onClick={handleClose} className="rounded-lg p-1.5 hover:bg-surface-hover transition-colors">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Avatar -- clickable to upload */}
          <div className="flex flex-col items-center gap-2">
            <div className="relative group cursor-pointer" onClick={() => fileRef.current?.click()}>
              {avatarUrl ? (
                <img src={avatarUrl} alt="Avatar" className="h-20 w-20 rounded-3xl object-cover border-2 border-primary/30 shadow-glow group-hover:opacity-80 transition-opacity" />
              ) : (
                <div className={`flex h-20 w-20 items-center justify-center rounded-3xl text-xl font-bold transition-transform group-hover:scale-105 ${
                  isChannel
                    ? "bg-gradient-to-br from-accent/30 to-accent/10 text-accent border border-accent/20"
                    : "bg-gradient-to-br from-primary/30 to-primary-glow/10 text-primary border border-primary/20"
                }`}>
                  {name.trim()
                    ? name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2)
                    : isChannel ? <Hash className="h-8 w-8" /> : <Users className="h-8 w-8" />
                  }
                </div>
              )}
              <div className="absolute inset-0 flex items-center justify-center rounded-3xl bg-black/0 group-hover:bg-black/30 transition-colors">
                <Camera className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>
            <button onClick={() => fileRef.current?.click()} className="text-[11px] font-medium text-primary hover:underline">
              {avatarUrl ? "Change Photo" : "Add Photo"}
            </button>
            {avatarUrl && (
              <button onClick={() => setAvatarUrl(null)} className="text-[11px] font-medium text-destructive hover:underline">
                Remove
              </button>
            )}
          </div>

          {/* Name */}
          <div>
            <label className="text-[10px] font-mono uppercase tracking-[0.15em] text-muted-foreground mb-1.5 block">
              {isChannel ? "Channel name" : "Group name"}
            </label>
            <input
              type="text"
              placeholder={isChannel ? "e.g. announcements" : "e.g. Project Alpha"}
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              className="w-full rounded-2xl glass border border-border/50 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 focus:shadow-glow transition-all bg-transparent"
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-[10px] font-mono uppercase tracking-[0.15em] text-muted-foreground mb-1.5 block">
              Description (optional)
            </label>
            <textarea
              placeholder="What is this about?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full rounded-2xl glass border border-border/50 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 focus:shadow-glow transition-all bg-transparent resize-none"
            />
          </div>

          {/* Info */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-primary/5 border border-primary/10">
            <Image className="h-4 w-4 text-primary flex-shrink-0" />
            <p className="text-[11px] text-muted-foreground">
              {type === "group" ? "Group will have a General topic by default" : "Members can share photos, videos, and audio"}
            </p>
          </div>

          {/* Create button */}
          <button
            onClick={handleCreate}
            disabled={!name.trim()}
            className={`w-full rounded-2xl py-3 text-sm font-semibold transition-all ${
              name.trim()
                ? "gradient-primary text-primary-foreground shadow-glow hover:scale-[1.02]"
                : "bg-secondary text-muted-foreground cursor-not-allowed"
            }`}
          >
            Create {isChannel ? "Channel" : "Group"}
          </button>
        </div>
      </div>
    </div>
  );
}
