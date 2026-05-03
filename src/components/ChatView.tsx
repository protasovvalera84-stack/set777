import { useState, useRef, useEffect, useCallback, lazy, Suspense, useMemo } from "react";
import {
  Phone, Video, MoreVertical, Paperclip, Smile, Send,
  Lock, Hash, Users, Sparkles, Mic, ArrowLeft,
  Image, Film, Music, X, Download, MessageCircle,
  Timer, Forward, Copy, Check, Clock, Search as SearchIcon,
} from "lucide-react";
import { Chat, Message, MediaAttachment, Topic } from "@/data/mockData";
import { TopicsBar } from "@/components/TopicsBar";
import { useMesh } from "@/lib/MeshProvider";
import { EmojiPicker } from "@/components/EmojiPicker";
import { GifPicker } from "@/components/GifPicker";
import { CreatePollDialog } from "@/components/Poll";
import { StickerPicker } from "@/components/StickerPicker";
import { Virtuoso } from "react-virtuoso";
import { GroupCallScreen } from "@/components/GroupCallScreen";
import { AiAssistant } from "@/components/AiAssistant";
import { VoiceChannels } from "@/components/VoiceChannels";
import { DocEditor } from "@/components/DocEditor";

// Lazy load heavy overlay components
const MediaGallery = lazy(() => import("@/components/MediaGallery").then(m => ({ default: m.MediaGallery })));
const FileManager = lazy(() => import("@/components/FileManager").then(m => ({ default: m.FileManager })));

interface ChatViewProps {
  chat: Chat;
  onSendMessage: (chatId: string, text: string, media?: MediaAttachment[], topicId?: string | null) => void;
  onBack: () => void;
  onCall?: (type: "audio" | "video") => void;
  onCreateTopic?: (chatId: string, name: string, icon: string) => void;
  onDeleteTopic?: (chatId: string, topicId: string) => void;
  onSettingsClick?: () => void;
  onDmSettingsClick?: () => void;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function downloadMedia(attachment: MediaAttachment) {
  const a = document.createElement("a");
  a.href = attachment.url;
  a.download = attachment.name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export function ChatView({ chat, onSendMessage, onBack, onCall, onCreateTopic, onDeleteTopic, onSettingsClick, onDmSettingsClick }: ChatViewProps) {
  const mesh = useMesh();
  const [input, setInput] = useState(() => {
    try { return localStorage.getItem(`meshlink-draft-${chat.id}`) || ""; } catch { return ""; }
  });
  const [pendingMedia, setPendingMedia] = useState<MediaAttachment[]>([]);
  const [activeTopic, setActiveTopic] = useState<string | null>(null);
  const [showTimerMenu, setShowTimerMenu] = useState(false);
  const [disappearTimer, setDisappearTimer] = useState<number | null>(() => {
    try {
      const saved = localStorage.getItem(`meshlink-timer-${chat.id}`);
      return saved ? parseInt(saved) : null;
    } catch { return null; }
  });
  const [forwardingMsg, setForwardingMsg] = useState<Message | null>(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [gifOpen, setGifOpen] = useState(false);
  const [pinnedMsg, setPinnedMsg] = useState<string | null>(() => {
    try {
      return localStorage.getItem(`meshlink-pin-${chat.id}`) || null;
    } catch { return null; }
  });
  const [pollOpen, setPollOpen] = useState(false);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [stickerOpen, setStickerOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [fileManagerOpen, setFileManagerOpen] = useState(false);
  const [chatSearch, setChatSearch] = useState("");
  const [chatSearchOpen, setChatSearchOpen] = useState(false);
  const [groupCallOpen, setGroupCallOpen] = useState(false);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [voiceChannelsOpen, setVoiceChannelsOpen] = useState(false);
  const [docEditorOpen, setDocEditorOpen] = useState(false);
  const virtuosoRef = useRef<any>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Get typing users for this chat
  const typingNames = mesh.typingUsers[chat.id] || [];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat.messages]);

  // Ctrl+F to open in-chat search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "f") {
        e.preventDefault();
        setChatSearchOpen(true);
      }
      if (e.key === "Escape") {
        setChatSearchOpen(false);
        setChatSearch("");
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Paste image from clipboard
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of Array.from(items)) {
        if (item.type.startsWith("image/")) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) mesh.sendMedia(chat.id, file, activeTopic);
        }
      }
    };
    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [mesh, chat.id, activeTopic]);

  // Drag & drop file upload handlers
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragOver(true); };
  const handleDragLeave = () => setIsDragOver(false);
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = e.dataTransfer.files;
    for (const file of Array.from(files)) {
      mesh.sendMedia(chat.id, file, activeTopic);
    }
  };

  // Send typing indicator when user types + save draft
  const handleInputChange = (value: string) => {
    setInput(value);
    // Save draft
    if (value.trim()) {
      localStorage.setItem(`meshlink-draft-${chat.id}`, value);
    } else {
      localStorage.removeItem(`meshlink-draft-${chat.id}`);
    }
    if (value.trim()) {
      mesh.sendTyping(chat.id, true);
      // Stop typing after 3 seconds of inactivity
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        mesh.sendTyping(chat.id, false);
      }, 3000);
    } else {
      mesh.sendTyping(chat.id, false);
    }
  };

  const handleSend = () => {
    if (!input.trim() && pendingMedia.length === 0) return;

    // If replying, send with reply context
    if (replyTo && input.trim() && mesh.client) {
      mesh.client.sendEvent(chat.id, "m.room.message" as Parameters<typeof mesh.client.sendEvent>[1], {
        msgtype: "m.text",
        body: `> ${replyTo.text}\n\n${input.trim()}`,
        "m.relates_to": { "m.in_reply_to": { event_id: replyTo.id } },
        ...(activeTopic ? { "org.meshlink.topic_id": activeTopic } : {}),
      }).catch(() => {});
      setInput("");
      setReplyTo(null);
      mesh.sendTyping(chat.id, false);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      return;
    }

    onSendMessage(chat.id, input.trim(), pendingMedia.length > 0 ? pendingMedia : undefined, activeTopic);
    setInput("");
    localStorage.removeItem(`meshlink-draft-${chat.id}`);
    setPendingMedia([]);
    setReplyTo(null);
    mesh.sendTyping(chat.id, false);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    // Schedule message deletion if disappearing timer is set
    if (disappearTimer && mesh.client) {
      setTimeout(() => {
        const room = mesh.client?.getRoom(chat.id);
        if (!room) return;
        const events = room.getLiveTimeline().getEvents();
        const lastMsg = events[events.length - 1];
        if (lastMsg && lastMsg.getSender() === mesh.client?.getUserId()) {
          mesh.client?.redactEvent(chat.id, lastMsg.getId()!).catch(() => {});
        }
      }, disappearTimer * 1000);
    }
  };

  const handleSetTimer = (seconds: number | null) => {
    setDisappearTimer(seconds);
    setShowTimerMenu(false);
    if (seconds) {
      localStorage.setItem(`meshlink-timer-${chat.id}`, String(seconds));
    } else {
      localStorage.removeItem(`meshlink-timer-${chat.id}`);
    }
  };

  const handleForward = useCallback((msg: Message) => {
    setForwardingMsg(msg);
  }, []);

  const handleForwardTo = useCallback((roomId: string) => {
    if (!forwardingMsg || !mesh.client) return;
    const text = forwardingMsg.text ? `↪ ${forwardingMsg.text}` : "";
    if (text) {
      mesh.client.sendEvent(roomId, "m.room.message" as Parameters<typeof mesh.client.sendEvent>[1], {
        msgtype: "m.text",
        body: text,
      }).catch(() => {});
    }
    setForwardingMsg(null);
  }, [forwardingMsg, mesh.client]);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      recordingChunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) recordingChunksRef.current.push(e.data); };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(recordingChunksRef.current, { type: "audio/webm" });
        const file = new File([blob], `voice-${Date.now()}.webm`, { type: "audio/webm" });
        await mesh.sendMedia(chat.id, file, activeTopic);
        if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
        setRecordingDuration(0);
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setRecordingDuration(0);
      recordingTimerRef.current = setInterval(() => setRecordingDuration((d) => d + 1), 1000);
    } catch {
      console.error("Microphone access denied");
    }
  }, [mesh, chat.id, activeTopic]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach((file) => {
      let type: MediaAttachment["type"] = "image";
      if (file.type.startsWith("video/")) type = "video";
      else if (file.type.startsWith("audio/")) type = "audio";

      const url = URL.createObjectURL(file);
      setPendingMedia((prev) => [
        ...prev,
        {
          id: `media-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          type,
          name: file.name,
          url,
          size: file.size,
          mimeType: file.type,
        },
      ]);
    });

    // Reset input so same file can be selected again
    e.target.value = "";
  };

  const removePendingMedia = (id: string) => {
    setPendingMedia((prev) => {
      const item = prev.find((m) => m.id === id);
      if (item) URL.revokeObjectURL(item.url);
      return prev.filter((m) => m.id !== id);
    });
  };

  return (
    <div
      className="relative flex h-full flex-1 flex-col bg-background overflow-hidden"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drag overlay */}
      {isDragOver && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-primary/10 backdrop-blur-sm border-2 border-dashed border-primary/50 rounded-2xl m-2">
          <div className="text-center">
            <Download className="h-12 w-12 text-primary mx-auto mb-2" />
            <p className="text-sm font-medium text-primary">Drop files to send</p>
          </div>
        </div>
      )}
      {/* Background glows */}
      <div className="pointer-events-none absolute top-1/4 right-1/4 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
      <div className="pointer-events-none absolute bottom-1/4 left-1/3 h-80 w-80 rounded-full bg-accent/10 blur-3xl" />

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,video/*,audio/*"
        className="hidden"
        onChange={handleFileSelect}
      />

      {/* Header */}
      <div className="chat-header relative z-10 flex items-center justify-between border-b border-border/40 px-3 md:px-6 py-2 md:py-3.5 glass-strong">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="md:hidden rounded-xl p-2 hover:bg-surface-hover transition-all">
            <ArrowLeft className="h-5 w-5 text-foreground" />
          </button>
          {chat.avatarUrl ? (
            <img src={chat.avatarUrl} alt="" className="h-10 w-10 rounded-2xl object-cover border border-border/40" />
          ) : (
            <div className={`flex h-10 w-10 items-center justify-center rounded-2xl text-xs font-bold ${
              chat.type === "channel"
                ? "bg-gradient-to-br from-accent/30 to-accent/10 text-accent border border-accent/20"
                : chat.type === "group"
                ? "bg-gradient-to-br from-primary/30 to-primary-glow/10 text-primary border border-primary/20"
                : "bg-gradient-to-br from-secondary to-muted text-foreground border border-border"
            }`}>
              {chat.avatar}
            </div>
          )}
          <div>
            <div className="flex items-center gap-1.5">
              {chat.type === "channel" && <Hash className="h-3.5 w-3.5 text-accent" />}
              {chat.type === "group" && <Users className="h-3.5 w-3.5 text-primary" />}
              <h2 className="text-base font-semibold text-foreground tracking-tight">{chat.name}</h2>
            </div>
            <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
              {chat.type === "dm" ? (
                chat.online ? (
                  <>
                    <span className="h-1.5 w-1.5 rounded-full bg-online animate-pulse" />
                    <span>online - encrypted</span>
                  </>
                ) : "last seen recently"
              ) : (
                <>
                  <Users className="h-3 w-3" />
                  <span>{chat.members} members - {Math.floor((chat.members ?? 0) * 0.6)} online</span>
                </>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-0.5">
          {/* Search — always visible */}
          <button onClick={() => setChatSearchOpen(true)} className="rounded-xl p-2 hover:bg-surface-hover" title="Search (Ctrl+F)">
            <SearchIcon className="h-4 w-4 text-muted-foreground" />
          </button>

          {/* Call buttons */}
          {(chat.type === "dm" || chat.type === "group") && onCall && (
            <>
              <button onClick={() => onCall("audio")} className="rounded-xl p-2 hover:bg-surface-hover" title="Audio call">
                <Phone className="h-4 w-4 text-muted-foreground" />
              </button>
              <button onClick={() => onCall("video")} className="hidden sm:flex rounded-xl p-2 hover:bg-surface-hover" title="Video call">
                <Video className="h-4 w-4 text-muted-foreground" />
              </button>
            </>
          )}

          {/* More menu (⋮) */}
          <div className="relative">
            <button onClick={() => setHeaderMenuOpen((v) => !v)} className="rounded-xl p-2 hover:bg-surface-hover">
              <MoreVertical className="h-4 w-4 text-muted-foreground" />
            </button>
            {headerMenuOpen && (
              <div className="fixed inset-0 z-[100]" onClick={() => setHeaderMenuOpen(false)}>
                <div className="absolute right-4 top-14 w-52 rounded-2xl glass-strong border border-border/60 shadow-elegant p-1.5 animate-fade-in-up bg-background/95 backdrop-blur-xl" onClick={(e) => e.stopPropagation()}>
                  <button onClick={() => { setChatSearchOpen(true); setHeaderMenuOpen(false); }} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-xs text-foreground hover:bg-surface-hover">
                    <SearchIcon className="h-4 w-4 text-muted-foreground" /> Search in Chat
                  </button>
                  {onCall && (
                    <button onClick={() => { onCall("video"); setHeaderMenuOpen(false); }} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-xs text-foreground hover:bg-surface-hover">
                      <Video className="h-4 w-4 text-muted-foreground" /> Video Call
                    </button>
                  )}
                  {chat.type === "group" && onCall && (
                    <button onClick={() => { setGroupCallOpen(true); setHeaderMenuOpen(false); }} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-xs text-foreground hover:bg-surface-hover">
                      <Users className="h-4 w-4 text-muted-foreground" /> Group Call
                    </button>
                  )}
                  <button onClick={() => { setGalleryOpen(true); setHeaderMenuOpen(false); }} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-xs text-foreground hover:bg-surface-hover">
                    <Image className="h-4 w-4 text-muted-foreground" /> Media Gallery
                  </button>
                  <button onClick={() => { setFileManagerOpen(true); setHeaderMenuOpen(false); }} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-xs text-foreground hover:bg-surface-hover">
                    <Paperclip className="h-4 w-4 text-muted-foreground" /> Shared Files
                  </button>
                  <button onClick={() => {
                    const lines = chat.messages.map((m) => `[${m.timestamp}] ${m.senderId === "me" ? "You" : m.senderId}: ${m.text || "[media]"}`);
                    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url; a.download = `${chat.name}-export.txt`; a.click();
                    URL.revokeObjectURL(url);
                    setHeaderMenuOpen(false);
                  }} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-xs text-foreground hover:bg-surface-hover">
                    <Download className="h-4 w-4 text-muted-foreground" /> Export Chat
                  </button>
                  <button onClick={() => { setShowTimerMenu(true); setHeaderMenuOpen(false); }} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-xs text-foreground hover:bg-surface-hover">
                    <Timer className={`h-4 w-4 ${disappearTimer ? "text-primary" : "text-muted-foreground"}`} />
                    {disappearTimer ? "Timer Active" : "Disappearing Msgs"}
                  </button>
                  <button onClick={() => { setAiOpen(true); setHeaderMenuOpen(false); }} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-xs text-foreground hover:bg-surface-hover">
                    <Sparkles className="h-4 w-4 text-primary" /> AI Assistant
                  </button>
                  {(chat.type === "group" || chat.type === "channel") && (
                    <button onClick={() => { setVoiceChannelsOpen(true); setHeaderMenuOpen(false); }} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-xs text-foreground hover:bg-surface-hover">
                      <Mic className="h-4 w-4 text-muted-foreground" /> Voice Channels
                    </button>
                  )}
                  <button onClick={() => { setDocEditorOpen(true); setHeaderMenuOpen(false); }} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-xs text-foreground hover:bg-surface-hover">
                    <Paperclip className="h-4 w-4 text-muted-foreground" /> Document Editor
                  </button>
                  <div className="border-t border-border/30 mt-1 pt-1">
                    {(chat.type === "group" || chat.type === "channel") && onSettingsClick && (
                      <button onClick={() => { onSettingsClick(); setHeaderMenuOpen(false); }} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-xs text-foreground hover:bg-surface-hover">
                        <MoreVertical className="h-4 w-4 text-muted-foreground" /> Group Settings
                      </button>
                    )}
                    {chat.type === "dm" && onDmSettingsClick && (
                      <button onClick={() => { onDmSettingsClick(); setHeaderMenuOpen(false); }} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-xs text-foreground hover:bg-surface-hover">
                        <MoreVertical className="h-4 w-4 text-muted-foreground" /> Chat Settings
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Timer menu (shown from header menu) */}
      {showTimerMenu && (
        <div className="absolute right-4 top-16 z-50 rounded-2xl glass-strong border border-border/60 shadow-elegant p-2 w-48 animate-fade-in-up">
          <p className="text-[9px] font-mono uppercase text-muted-foreground px-2 py-1 mb-1">Auto-delete messages</p>
          {[
            { label: "Off", value: null },
            { label: "5 seconds", value: 5 },
            { label: "30 seconds", value: 30 },
            { label: "5 minutes", value: 300 },
            { label: "1 hour", value: 3600 },
            { label: "24 hours", value: 86400 },
          ].map((opt) => (
            <button
              key={opt.label}
              onClick={() => handleSetTimer(opt.value)}
              className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs transition-all ${
                disappearTimer === opt.value ? "bg-primary/10 text-primary" : "text-foreground hover:bg-surface-hover"
              }`}
            >
              {opt.label}
              {disappearTimer === opt.value && <Check className="h-3 w-3" />}
            </button>
          ))}
        </div>
      )}

      {/* E2EE banner */}
      <div className="e2ee-banner relative z-10 flex items-center justify-center gap-2 py-1.5 md:py-2 bg-gradient-to-r from-primary/5 via-primary/10 to-accent/5 border-b border-border/30">
        <Lock className="h-3 w-3 text-primary" />
        <span className="text-[10px] font-mono uppercase tracking-[0.15em] gradient-text font-semibold">
          end-to-end encrypted - Matrix protocol
        </span>
        <Sparkles className="h-3 w-3 text-accent" />
      </div>

      {/* In-chat search bar */}
      {chatSearchOpen && (
        <div className="relative z-10 flex items-center gap-2 px-4 py-2 bg-surface-hover/50 border-b border-border/30">
          <SearchIcon className="h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            value={chatSearch}
            onChange={(e) => setChatSearch(e.target.value)}
            placeholder="Search in chat..."
            autoFocus
            className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground outline-none"
          />
          <span className="text-[9px] text-muted-foreground">
            {chatSearch ? `${chat.messages.filter((m) => m.text?.toLowerCase().includes(chatSearch.toLowerCase())).length} found` : ""}
          </span>
          <button onClick={() => { setChatSearchOpen(false); setChatSearch(""); }} className="p-1 hover:bg-surface-hover rounded-lg">
            <X className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </div>
      )}

      {/* Pinned message banner */}
      {pinnedMsg && (
        <div className="relative z-10 flex items-center gap-2 px-4 py-1.5 bg-primary/5 border-b border-border/30">
          <div className="w-0.5 h-4 rounded-full bg-primary" />
          <p className="flex-1 text-[11px] text-foreground truncate">{pinnedMsg}</p>
          <button onClick={() => { setPinnedMsg(null); localStorage.removeItem(`meshlink-pin-${chat.id}`); }} className="text-muted-foreground hover:text-foreground">
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      {/* Topics bar for groups -- always show so users can create first topic */}
      {(chat.type === "group" || chat.type === "channel") && onCreateTopic && (
        <TopicsBar
          topics={chat.topics || []}
          activeTopic={activeTopic}
          onSelectTopic={setActiveTopic}
          onCreateTopic={(name, icon) => onCreateTopic?.(chat.id, name, icon)}
          onDeleteTopic={(topicId) => onDeleteTopic?.(chat.id, topicId)}
        />
      )}

      {/* Messages */}
      <div className="relative z-10 flex-1 overflow-hidden">
        <div className="h-full">
          {(() => {
            const hasTopics = (chat.type === "group" || chat.type === "channel") && chat.topics && chat.topics.length > 0;
            const filtered = hasTopics && activeTopic !== null
              ? chat.messages.filter((m) => m.topicId === activeTopic || m.senderId === "system")
              : chat.messages;
            return filtered.length > 0 ? (
              <Virtuoso
                ref={virtuosoRef}
                data={filtered}
                followOutput="smooth"
                atBottomStateChange={(atBottom) => setShowScrollBtn(!atBottom)}
                className="h-full px-4 md:px-6 scrollbar-thin"
                itemContent={(i, msg) => {
                  const showDate = i === 0 || (i > 0 && msg.timestamp?.split(" ")[0] !== filtered[i - 1]?.timestamp?.split(" ")[0]);
                  const showUnread = i > 0 && msg.senderId !== "me" && !msg.read && (i === 0 || filtered[i - 1]?.read || filtered[i - 1]?.senderId === "me");
                  return (
                    <div className="max-w-3xl mx-auto">
                      {showDate && msg.timestamp && (
                        <div className="flex items-center gap-3 my-3">
                          <div className="flex-1 h-px bg-border/40" />
                          <span className="text-[9px] font-mono text-muted-foreground/60 uppercase">{msg.timestamp.split(" ")[0] || "Today"}</span>
                          <div className="flex-1 h-px bg-border/40" />
                        </div>
                      )}
                      {showUnread && (
                        <div className="flex items-center gap-3 my-2">
                          <div className="flex-1 h-px bg-primary/50" />
                          <span className="text-[9px] font-mono text-primary uppercase">New messages</span>
                          <div className="flex-1 h-px bg-primary/50" />
                        </div>
                      )}
                      <div className="py-1">
                        <MessageBubble message={msg} index={i} chatType={chat.type} roomId={chat.id} onForward={handleForward} onPin={(text) => { setPinnedMsg(text); localStorage.setItem(`meshlink-pin-${chat.id}`, text); }} onReply={setReplyTo} />
                      </div>
                    </div>
                  );
                }}
              />
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center h-full">
                <Hash className="h-8 w-8 text-muted-foreground/30 mb-3" />
                <p className="text-sm text-muted-foreground">No messages in this topic yet</p>
                <p className="text-[11px] text-muted-foreground/60 mt-1">Be the first to write something</p>
              </div>
            );
          })()}
        </div>

        {/* Scroll to bottom FAB with unread count */}
        {showScrollBtn && (
          <button
            onClick={() => virtuosoRef.current?.scrollToIndex({ index: "LAST", behavior: "smooth" })}
            className="absolute bottom-4 right-4 z-20 flex h-10 w-10 items-center justify-center rounded-full gradient-primary text-primary-foreground shadow-glow hover:scale-110 transition-all animate-fade-in-up"
            title="Scroll to bottom"
          >
            <ArrowLeft className="h-4 w-4 rotate-[-90deg]" />
            {chat.unread > 0 && (
              <span className="absolute -top-1 -right-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-white px-1">
                {chat.unread}
              </span>
            )}
          </button>
        )}
      </div>

      {/* Pending media preview */}
      {pendingMedia.length > 0 && (
        <div className="relative z-10 border-t border-border/30 px-3 md:px-6 py-2 glass">
          <div className="mx-auto max-w-3xl">
            <p className="text-[9px] font-mono uppercase text-muted-foreground mb-1.5">{pendingMedia.length} file{pendingMedia.length > 1 ? "s" : ""} ready to send</p>
            <div className="flex gap-2 overflow-x-auto scrollbar-thin pb-1">
              {pendingMedia.map((m) => (
                <div key={m.id} className="relative flex-shrink-0 group">
                  {m.type === "image" ? (
                    <img src={m.url} alt={m.name} className="h-20 w-20 rounded-xl object-cover border border-border/40" />
                  ) : m.type === "video" ? (
                    <div className="h-20 w-20 rounded-xl bg-secondary border border-border/40 flex flex-col items-center justify-center gap-1">
                      <Film className="h-6 w-6 text-primary" />
                      <span className="text-[8px] text-muted-foreground">Video</span>
                    </div>
                  ) : (
                    <div className="h-20 w-20 rounded-xl bg-secondary border border-border/40 flex flex-col items-center justify-center gap-1">
                      <Music className="h-6 w-6 text-accent" />
                      <span className="text-[8px] text-muted-foreground">Audio</span>
                    </div>
                  )}
                  <p className="text-[8px] text-muted-foreground truncate w-20 mt-0.5">{m.name}</p>
                  {m.size && <p className="text-[7px] text-muted-foreground/60">{(m.size / 1024).toFixed(0)} KB</p>}
                  <button
                    onClick={() => removePendingMedia(m.id)}
                    className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Typing indicator */}
      {typingNames.length > 0 && (
        <div className="relative z-10 px-4 md:px-6 py-1">
          <p className="text-[11px] text-primary animate-pulse">
            {typingNames.length === 1
              ? `${typingNames[0]} печатает...`
              : `${typingNames.join(", ")} печатают...`}
          </p>
        </div>
      )}

      {/* Emoji Picker */}
      <div className="relative">
        <EmojiPicker
          open={emojiOpen}
          onClose={() => setEmojiOpen(false)}
          onSelect={(emoji) => { handleInputChange(input + emoji); setEmojiOpen(false); }}
        />
      </div>

      {/* GIF Picker */}
      <div className="relative">
        <GifPicker
          open={gifOpen}
          onClose={() => setGifOpen(false)}
          onSelect={(gifUrl) => {
            // Send GIF as image message
            if (mesh.client) {
              mesh.client.sendEvent(chat.id, "m.room.message" as Parameters<typeof mesh.client.sendEvent>[1], {
                msgtype: "m.image",
                body: "GIF",
                url: gifUrl,
                info: { mimetype: "image/gif" },
              }).catch(() => {});
            }
            setGifOpen(false);
          }}
        />
      </div>

      {/* Sticker Picker */}
      <div className="relative">
        <StickerPicker
          open={stickerOpen}
          onClose={() => setStickerOpen(false)}
          onSelect={(sticker) => {
            if (mesh.client) {
              mesh.client.sendEvent(chat.id, "m.room.message" as Parameters<typeof mesh.client.sendEvent>[1], {
                msgtype: "m.text",
                body: sticker,
                "org.meshlink.sticker": true,
              }).catch(() => {});
            }
            setStickerOpen(false);
          }}
        />
      </div>

      {/* Reply banner */}
      {replyTo && (
        <div className="relative z-10 flex items-center gap-2 px-4 md:px-6 py-2 border-t border-border/30 bg-primary/5">
          <div className="w-0.5 h-6 rounded-full bg-primary" />
          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-primary font-medium">Reply to {replyTo.senderId === "me" ? "yourself" : replyTo.senderId}</p>
            <p className="text-[11px] text-muted-foreground truncate">{replyTo.text || "[media]"}</p>
          </div>
          <button onClick={() => setReplyTo(null)} className="p-1 hover:bg-surface-hover rounded-lg">
            <X className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </div>
      )}

      {/* Input */}
      <div className="chat-input relative z-10 border-t border-border/40 px-2 md:px-6 py-1.5 md:py-3 glass-strong">
        {/* Media buttons row (scrollable on mobile) */}
        <div className="flex items-center gap-1 mb-1 mx-auto max-w-3xl overflow-x-auto scrollbar-thin pb-0.5">
          <button onClick={() => fileInputRef.current?.click()} className="flex-shrink-0 rounded-lg p-1.5 hover:bg-surface-hover" title="Attach file">
            <Paperclip className="h-4 w-4 text-muted-foreground" />
          </button>
          <button onClick={() => {
            if (fileInputRef.current) { fileInputRef.current.accept = "image/*"; fileInputRef.current.click(); fileInputRef.current.accept = "image/*,video/*,audio/*"; }
          }} className="flex-shrink-0 rounded-lg p-1.5 hover:bg-surface-hover" title="Photo">
            <Image className="h-4 w-4 text-muted-foreground" />
          </button>
          <button onClick={() => { setEmojiOpen((v) => !v); setStickerOpen(false); setGifOpen(false); }} className="flex-shrink-0 rounded-lg p-1.5 hover:bg-surface-hover" title="Emoji">
            <Smile className="h-4 w-4 text-muted-foreground" />
          </button>
          <button onClick={() => { setGifOpen((v) => !v); setEmojiOpen(false); setStickerOpen(false); }} className="flex-shrink-0 rounded-lg p-1.5 hover:bg-surface-hover" title="GIF">
            <span className="text-[9px] font-bold text-muted-foreground border border-muted-foreground/40 rounded px-1">GIF</span>
          </button>
          <button onClick={() => { setStickerOpen((v) => !v); setEmojiOpen(false); setGifOpen(false); }} className="flex-shrink-0 rounded-lg p-1.5 hover:bg-surface-hover" title="Stickers">
            <span className="text-xs">🎭</span>
          </button>
          <button onClick={isRecording ? stopRecording : startRecording} className={`flex-shrink-0 rounded-lg p-1.5 hover:bg-surface-hover ${isRecording ? "text-destructive animate-pulse" : ""}`} title={isRecording ? `${recordingDuration}s` : "Voice"}>
            <Mic className={`h-4 w-4 ${isRecording ? "text-destructive" : "text-muted-foreground"}`} />
          </button>
          <button onClick={() => {
            if (!navigator.geolocation) return;
            navigator.geolocation.getCurrentPosition((pos) => {
              const { latitude, longitude } = pos.coords;
              const mapUrl = `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=15/${latitude}/${longitude}`;
              onSendMessage(chat.id, `📍 ${latitude.toFixed(5)}, ${longitude.toFixed(5)}\n${mapUrl}`, undefined, activeTopic);
            }, () => {}, { enableHighAccuracy: true, timeout: 10000 });
          }} className="flex-shrink-0 rounded-lg p-1.5 hover:bg-surface-hover" title="Location">
            <span className="text-xs">📍</span>
          </button>
          {(chat.type === "group" || chat.type === "channel") && (
            <button onClick={() => setPollOpen(true)} className="flex-shrink-0 rounded-lg p-1.5 hover:bg-surface-hover" title="Poll">
              <span className="text-xs">📊</span>
            </button>
          )}
          {input.length > 0 && (
            <>
              <div className="w-px h-4 bg-border/40 flex-shrink-0 mx-0.5" />
              <button onClick={() => handleInputChange(input + "****")} className="flex-shrink-0 rounded-lg px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground hover:bg-surface-hover" title="Bold">B</button>
              <button onClick={() => handleInputChange(input + "**")} className="flex-shrink-0 rounded-lg px-1.5 py-0.5 text-[10px] italic text-muted-foreground hover:bg-surface-hover" title="Italic">I</button>
              <button onClick={() => handleInputChange(input + "``")} className="flex-shrink-0 rounded-lg px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground hover:bg-surface-hover" title="Code">&lt;/&gt;</button>
            </>
          )}
        </div>
        {/* Quick reply templates (shown when input empty) */}
        {!input && chat.messages.length > 0 && (
          <div className="flex gap-1.5 mb-1.5 mx-auto max-w-3xl overflow-x-auto scrollbar-thin pb-0.5">
            {["👍", "Thanks!", "OK", "Got it", "😊", "On my way", "Call me"].map((t) => (
              <button key={t} onClick={() => onSendMessage(chat.id, t, undefined, activeTopic)}
                className="flex-shrink-0 rounded-full px-2.5 py-1 text-[10px] border border-border/40 text-muted-foreground hover:bg-surface-hover hover:text-foreground transition-all">
                {t}
              </button>
            ))}
          </div>
        )}
        {/* Input + Send row */}
        <div className="mx-auto flex max-w-3xl items-center gap-1.5">
          <input
            type="text"
            placeholder="Message..."
            value={input}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
            className="flex-1 rounded-2xl glass border border-border/50 px-3 py-2 md:py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50"
          />
          {input.length > 0 && (
            <span className={`text-[9px] font-mono flex-shrink-0 ${input.length > 4000 ? "text-destructive" : input.length > 3000 ? "text-yellow-500" : "text-muted-foreground/40"}`}>
              {input.length}
            </span>
          )}
          <div className="relative">
            <button
              onClick={handleSend}
              onContextMenu={(e) => { e.preventDefault(); if (input.trim()) setScheduleOpen(true); }}
              className={`rounded-2xl p-2.5 md:p-3 transition-all hover:scale-105 ${
                input.trim() || pendingMedia.length > 0
                  ? "gradient-primary text-primary-foreground shadow-glow"
                  : "bg-secondary text-muted-foreground"
              }`}
            >
              <Send className="h-4 w-4" />
            </button>
            {/* Schedule menu (right-click on send) */}
            {scheduleOpen && (
              <div className="absolute bottom-full right-0 mb-2 z-50 rounded-2xl glass-strong border border-border/60 shadow-elegant p-2 w-44 animate-fade-in-up">
                <p className="text-[9px] font-mono uppercase text-muted-foreground px-2 py-1 mb-1">Schedule send</p>
                {[
                  { label: "In 1 minute", ms: 60000 },
                  { label: "In 5 minutes", ms: 300000 },
                  { label: "In 30 minutes", ms: 1800000 },
                  { label: "In 1 hour", ms: 3600000 },
                  { label: "In 3 hours", ms: 10800000 },
                ].map((opt) => (
                  <button
                    key={opt.label}
                    onClick={() => {
                      const text = input.trim();
                      if (!text) return;
                      setScheduleOpen(false);
                      setInput("");
                      localStorage.removeItem(`meshlink-draft-${chat.id}`);
                      setTimeout(() => {
                        onSendMessage(chat.id, text, undefined, activeTopic);
                      }, opt.ms);
                    }}
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs text-foreground hover:bg-surface-hover transition-all"
                  >
                    <Clock className="h-3 w-3 text-muted-foreground" />
                    {opt.label}
                  </button>
                ))}
                <button onClick={() => setScheduleOpen(false)} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs text-muted-foreground hover:bg-surface-hover mt-1">
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Create Poll dialog */}
      <CreatePollDialog
        open={pollOpen}
        onClose={() => setPollOpen(false)}
        onCreate={(question, options) => {
          if (!mesh.client) return;
          const pollMsg = `📊 **${question}**\n${options.map((o, i) => `${i + 1}. ${o}`).join("\n")}\n\n_Reply with the option number to vote_`;
          mesh.client.sendEvent(chat.id, "m.room.message" as Parameters<typeof mesh.client.sendEvent>[1], {
            msgtype: "m.text",
            body: pollMsg,
            format: "org.matrix.custom.html",
            formatted_body: `<b>📊 ${question}</b><br/>${options.map((o, i) => `${i + 1}. ${o}`).join("<br/>")}`,
            "org.meshlink.poll": { question, options },
          }).catch(() => {});
        }}
      />

      {/* File Manager & Media Gallery (lazy loaded) */}
      <Suspense fallback={null}>
        {fileManagerOpen && (
          <FileManager
            open={fileManagerOpen}
            onClose={() => setFileManagerOpen(false)}
            messages={chat.messages}
            chatName={chat.name}
          />
        )}
        {galleryOpen && (
          <MediaGallery
            open={galleryOpen}
            onClose={() => setGalleryOpen(false)}
            messages={chat.messages}
            chatName={chat.name}
          />
        )}
      </Suspense>

      {/* Group Call Screen */}
      <GroupCallScreen
        open={groupCallOpen}
        chatName={chat.name}
        participants={chat.memberIds || []}
        onEnd={() => setGroupCallOpen(false)}
      />

      {/* AI Assistant */}
      <AiAssistant
        open={aiOpen}
        onClose={() => setAiOpen(false)}
        onInsert={(text) => { handleInputChange(input + text); setAiOpen(false); }}
        chatContext={chat.messages.slice(-5).map((m) => `${m.senderId}: ${m.text}`).join("\n")}
      />

      {/* Voice Channels */}
      <VoiceChannels open={voiceChannelsOpen} onClose={() => setVoiceChannelsOpen(false)} chatName={chat.name} />

      {/* Document Editor */}
      <DocEditor open={docEditorOpen} onClose={() => setDocEditorOpen(false)} chatId={chat.id} />

      {/* Forward message dialog */}
      {forwardingMsg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in-up" onClick={() => setForwardingMsg(null)}>
          <div className="absolute inset-0 bg-background/70 backdrop-blur-sm" />
          <div onClick={(e) => e.stopPropagation()} className="relative w-full max-w-sm rounded-3xl glass-strong border border-border/60 shadow-elegant p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-serif italic gradient-text">Forward to</h3>
              <button onClick={() => setForwardingMsg(null)} className="rounded-lg p-1.5 hover:bg-surface-hover">
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
            <div className="text-xs text-muted-foreground mb-3 px-2 py-1.5 rounded-xl bg-secondary/50 truncate">
              ↪ {forwardingMsg.text || "[media]"}
            </div>
            <div className="max-h-60 overflow-y-auto space-y-1">
              {mesh.rooms.filter((r) => r.id !== chat.id).map((room) => (
                <button
                  key={room.id}
                  onClick={() => handleForwardTo(room.id)}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-surface-hover transition-all"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-primary-glow/5 text-xs font-bold text-primary border border-primary/20">
                    {room.avatar}
                  </div>
                  <span className="text-sm text-foreground truncate">{room.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MediaDisplay({ attachment }: { attachment: MediaAttachment }) {
  if (attachment.type === "image") {
    return (
      <div className="relative group mt-2 rounded-xl overflow-hidden">
        <img src={attachment.url} alt={attachment.name} className="max-w-full max-h-64 rounded-xl object-cover" />
        <button
          onClick={() => downloadMedia(attachment)}
          className="absolute top-2 right-2 h-8 w-8 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <Download className="h-4 w-4 text-white" />
        </button>
      </div>
    );
  }

  if (attachment.type === "video") {
    return (
      <div className="mt-2 rounded-xl overflow-hidden">
        <video src={attachment.url} controls className="max-w-full max-h-64 rounded-xl" />
        <div className="flex items-center justify-between mt-1">
          <span className="text-[10px] text-muted-foreground font-mono">{attachment.name}</span>
          <button onClick={() => downloadMedia(attachment)} className="hover:text-primary transition-colors">
            <Download className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </div>
      </div>
    );
  }

  if (attachment.type === "audio") {
    return (
      <div className="mt-2 rounded-xl glass border border-border/40 p-3">
        <div className="flex items-center gap-2 mb-2">
          <Music className="h-4 w-4 text-accent flex-shrink-0" />
          <span className="text-xs text-foreground truncate">{attachment.name}</span>
          <span className="text-[10px] text-muted-foreground font-mono flex-shrink-0">{formatFileSize(attachment.size)}</span>
          <button onClick={() => downloadMedia(attachment)} className="ml-auto hover:text-primary transition-colors">
            <Download className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </div>
        <div className="flex items-center gap-2">
          <audio src={attachment.url} controls className="flex-1 h-8" />
          <select
            onChange={(e) => {
              const audio = e.target.closest("div")?.querySelector("audio");
              if (audio) audio.playbackRate = parseFloat(e.target.value);
            }}
            defaultValue="1"
            className="rounded-lg bg-secondary border border-border/40 text-[9px] text-muted-foreground px-1 py-0.5 outline-none"
          >
            <option value="0.5">0.5x</option>
            <option value="1">1x</option>
            <option value="1.5">1.5x</option>
            <option value="2">2x</option>
          </select>
        </div>
      </div>
    );
  }

  return null;
}

function MessageBubble({ message, index, chatType, roomId, onForward, onPin, onReply }: { message: Message; index: number; chatType?: string; roomId?: string; onForward?: (msg: Message) => void; onPin?: (text: string) => void; onReply?: (msg: Message) => void }) {
  const isOwn = message.senderId === "me";
  const isSystem = message.senderId === "system";
  const isGroup = chatType === "group" || chatType === "channel";
  const hasMedia = message.media && message.media.length > 0;
  const mesh = useMesh();

  const [reactions, setReactions] = useState<string[]>([]);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [showReply, setShowReply] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(message.text);
  const [swipeX, setSwipeX] = useState(0);
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);

  const QUICK_REACTIONS = ["❤️", "👍", "😂", "😮", "😢", "🔥", "👏", "🎉"];

  const sendReaction = (key: string) => {
    if (!mesh.client || !roomId) return;
    mesh.client.sendEvent(roomId, "m.reaction" as Parameters<typeof mesh.client.sendEvent>[1], {
      "m.relates_to": {
        rel_type: "m.annotation",
        event_id: message.id,
        key,
      },
    }).catch(() => {});
    setReactions((prev) => prev.includes(key) ? prev.filter((r) => r !== key) : [...prev, key]);
    setShowReactionPicker(false);
  };

  const handleEdit = () => {
    if (!editText.trim() || !mesh.client || !roomId) return;
    mesh.client.sendEvent(roomId, "m.room.message" as Parameters<typeof mesh.client.sendEvent>[1], {
      msgtype: "m.text",
      body: `* ${editText.trim()}`,
      "m.new_content": { msgtype: "m.text", body: editText.trim() },
      "m.relates_to": { rel_type: "m.replace", event_id: message.id },
    }).catch(() => {});
    setIsEditing(false);
  };

  const handleDeleteForEveryone = () => {
    if (!mesh.client || !roomId) return;
    mesh.client.redactEvent(roomId, message.id).catch(() => {});
  };

  const handleReply = () => {
    if (!replyText.trim() || !mesh.client || !roomId) return;
    mesh.client.sendEvent(roomId, "m.room.message" as Parameters<typeof mesh.client.sendEvent>[1], {
      msgtype: "m.text",
      body: replyText.trim(),
      "m.relates_to": {
        "m.in_reply_to": { event_id: message.id },
      },
    }).catch(() => {});
    setReplyText("");
    setShowReply(false);
  };

  if (isSystem) {
    return (
      <div className="flex justify-center animate-fade-in-up" style={{ animationDelay: `${index * 30}ms` }}>
        <div className="max-w-[90%] md:max-w-[80%] rounded-2xl glass border border-primary/20 px-4 md:px-5 py-3 md:py-4 shadow-soft">
          <p className="text-xs font-mono text-foreground whitespace-pre-line leading-relaxed">{message.text}</p>
          <p className="mt-2 text-[10px] font-mono text-muted-foreground text-center">{message.timestamp}</p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={bubbleRef}
      className={`flex ${isOwn ? "justify-end" : "justify-start"} animate-fade-in-up`}
      style={{ animationDelay: `${index * 30}ms`, transform: `translateX(${swipeX}px)`, transition: swipeX === 0 ? "transform 0.2s" : "none" }}
      onDoubleClick={() => { if (isOwn && message.text) setIsEditing(true); }}
      onTouchStart={(e) => {
        touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, time: Date.now() };
      }}
      onTouchMove={(e) => {
        if (!touchStartRef.current) return;
        const dx = e.touches[0].clientX - touchStartRef.current.x;
        const dy = Math.abs(e.touches[0].clientY - touchStartRef.current.y);
        // Only horizontal swipe (not scroll)
        if (dy > 30) { touchStartRef.current = null; setSwipeX(0); return; }
        if (!isOwn && dx > 0) setSwipeX(Math.min(dx * 0.5, 60));
        if (isOwn && dx < 0) setSwipeX(Math.max(dx * 0.5, -60));
      }}
      onTouchEnd={() => {
        // Swipe to reply threshold
        if (Math.abs(swipeX) > 40 && onReply) {
          onReply(message);
        }
        // Double-tap to react
        if (touchStartRef.current && Date.now() - touchStartRef.current.time < 300) {
          const now = Date.now();
          if ((bubbleRef.current as any)?.__lastTap && now - (bubbleRef.current as any).__lastTap < 400) {
            sendReaction("❤️");
          }
          if (bubbleRef.current) (bubbleRef.current as any).__lastTap = now;
        }
        setSwipeX(0);
        touchStartRef.current = null;
      }}
    >
      <div
        className={`max-w-[85%] md:max-w-[75%] rounded-3xl px-4 py-2.5 ${
          isOwn
            ? "rounded-br-md text-primary-foreground shadow-elegant"
            : "rounded-bl-md bg-chat-other border border-border/40"
        }`}
        style={isOwn ? { background: "var(--gradient-bubble-own)" } : undefined}
      >
        {!isOwn && (
          <p className="text-[11px] font-semibold gradient-text-accent mb-1">
            {message.senderId.charAt(0).toUpperCase() + message.senderId.slice(1)}
          </p>
        )}
        {/* Quote (replied-to message) */}
        {message.text?.startsWith("> ") && (
          <div className={`rounded-lg px-2 py-1 mb-1 border-l-2 ${isOwn ? "border-white/40 bg-white/10" : "border-primary/40 bg-primary/5"}`}>
            <p className={`text-[10px] truncate ${isOwn ? "text-white/60" : "text-muted-foreground"}`}>
              {message.text.split("\n")[0].replace(/^> /, "")}
            </p>
          </div>
        )}
        {message.text && !isEditing && (() => {
          const displayText = message.text.startsWith("> ") ? message.text.split("\n").slice(1).join("\n").trim() : message.text;

          // Interactive poll detection (📊 prefix)
          if (displayText.startsWith("📊")) {
            const lines = displayText.split("\n").filter((l) => l.trim());
            const question = lines[0]?.replace("📊 **", "").replace("**", "").replace("📊 ", "") || "Poll";
            const options = lines.slice(1).filter((l) => /^\d+\./.test(l.trim())).map((l) => l.replace(/^\d+\.\s*/, "").trim());
            if (options.length >= 2) {
              return (
                <div className="mt-1">
                  <p className={`text-sm font-semibold mb-2 ${isOwn ? "text-white" : "text-foreground"}`}>📊 {question}</p>
                  <div className="space-y-1.5">
                    {options.map((opt, oi) => (
                      <button key={oi} onClick={() => {
                        if (mesh.client && roomId) {
                          mesh.client.sendEvent(roomId, "m.room.message" as any, {
                            msgtype: "m.text",
                            body: `Vote: ${opt}`,
                            "m.relates_to": { "m.in_reply_to": { event_id: message.id } },
                          }).catch(() => {});
                        }
                      }} className={`w-full text-left rounded-xl px-3 py-2 text-xs border transition-all ${isOwn ? "border-white/20 hover:bg-white/10 text-white" : "border-border/30 hover:bg-surface-hover text-foreground"}`}>
                        {oi + 1}. {opt}
                      </button>
                    ))}
                  </div>
                </div>
              );
            }
          }

          // Single emoji = big animated
          const isSingleEmoji = /^[\p{Emoji}\u200d\ufe0f]{1,6}$/u.test(displayText.trim()) && displayText.trim().length <= 6;
          if (isSingleEmoji) {
            return <p className="text-4xl py-1 animate-bounce" style={{ animationDuration: "1s", animationIterationCount: 1 }}>{displayText}</p>;
          }
          return (
            <p className={`text-sm whitespace-pre-line leading-relaxed ${isOwn ? "text-white" : "text-foreground"}`}>
              <LinkifiedText text={displayText} isOwn={isOwn} />
            </p>
          );
        })()}
        {/* Edited marker */}
        {message.text?.startsWith("* ") && (
          <span className={`text-[8px] ${isOwn ? "text-white/40" : "text-muted-foreground/40"}`}>(edited)</span>
        )}
        {isEditing && (
          <div className="flex items-center gap-1.5 mt-1">
            <input
              type="text"
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleEdit()}
              autoFocus
              className="flex-1 rounded-xl bg-background/50 border border-border/40 px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-primary/50"
            />
            <button onClick={handleEdit} className="text-[9px] text-primary font-medium">Save</button>
            <button onClick={() => setIsEditing(false)} className="text-[9px] text-muted-foreground">Cancel</button>
          </div>
        )}
        {message.media && message.media.map((m) => (
          <MediaDisplay key={m.id} attachment={m} />
        ))}
        <p className={`mt-1 text-[10px] ${isOwn ? "text-white/70" : "text-muted-foreground"} text-right font-mono`}>
          {message.timestamp}
          {isOwn && (
            <span className="ml-1" title={message.read ? "Read" : "Sent"}>
              {message.read ? "\u2713\u2713" : "\u2713"}
            </span>
          )}
          {isOwn && message.read && isGroup && (
            <span className="ml-1 text-[8px] text-primary/70">seen</span>
          )}
        </p>

        {/* Forward, Pin & Reply buttons */}
        {message.text && (
          <div className={`message-actions mt-1 flex items-center gap-1 text-[10px] flex-wrap ${isOwn ? "text-white/40" : "text-muted-foreground/40"}`}>
            {onReply && (
              <button onClick={() => onReply(message)} className={`px-1.5 py-0.5 rounded ${isOwn ? "hover:text-white/80 hover:bg-white/10" : "hover:text-muted-foreground hover:bg-surface-hover"}`} title="Reply">↩</button>
            )}
            {onForward && (
              <button onClick={() => onForward(message)} className={`px-1.5 py-0.5 rounded ${isOwn ? "hover:text-white/80 hover:bg-white/10" : "hover:text-muted-foreground hover:bg-surface-hover"}`} title="Forward">↪</button>
            )}
            {onPin && (
              <button onClick={() => onPin(message.text)} className={`px-1.5 py-0.5 rounded ${isOwn ? "hover:text-white/80 hover:bg-white/10" : "hover:text-muted-foreground hover:bg-surface-hover"}`} title="Pin">📌</button>
            )}
            <button onClick={() => navigator.clipboard?.writeText(message.text).catch(() => {})} className={`px-1.5 py-0.5 rounded ${isOwn ? "hover:text-white/80 hover:bg-white/10" : "hover:text-muted-foreground hover:bg-surface-hover"}`} title="Copy">📋</button>
            <button onClick={() => {
              try { const saved = JSON.parse(localStorage.getItem("meshlink-bookmarks") || "[]"); saved.unshift({ text: message.text, timestamp: message.timestamp, id: message.id }); localStorage.setItem("meshlink-bookmarks", JSON.stringify(saved.slice(0, 100))); } catch {}
            }} className={`px-1.5 py-0.5 rounded ${isOwn ? "hover:text-white/80 hover:bg-white/10" : "hover:text-muted-foreground hover:bg-surface-hover"}`} title="Save">🔖</button>
            <button onClick={() => {
              const text = message.text;
              const lang = navigator.language.startsWith("ru") ? "ru" : "en";
              const target = lang === "ru" ? "en" : "ru";
              window.open(`https://translate.google.com/?sl=auto&tl=${target}&text=${encodeURIComponent(text)}`, "_blank");
            }} className={`px-1.5 py-0.5 rounded ${isOwn ? "hover:text-white/80 hover:bg-white/10" : "hover:text-muted-foreground hover:bg-surface-hover"}`} title="Translate">🌐</button>
            {isOwn && (
              <>
                <button onClick={() => setIsEditing(true)} className="px-1.5 py-0.5 rounded hover:text-white/80 hover:bg-white/10" title="Edit">✏️</button>
                <button onClick={handleDeleteForEveryone} className="px-1.5 py-0.5 rounded hover:text-destructive hover:bg-destructive/10" title="Delete">🗑️</button>
              </>
            )}
          </div>
        )}

        {/* Reactions display */}
        {reactions.length > 0 && (
          <div className="flex items-center gap-1 mt-1.5 flex-wrap">
            {reactions.map((r, i) => (
              <span key={i} className="inline-flex items-center rounded-full bg-primary/10 border border-primary/20 px-1.5 py-0.5 text-xs">
                {r}
              </span>
            ))}
          </div>
        )}

        {/* Reaction picker */}
        <div className="relative mt-1">
          <button
            onClick={() => setShowReactionPicker((v) => !v)}
            className={`text-[9px] ${isOwn ? "text-white/40 hover:text-white/70" : "text-muted-foreground/40 hover:text-muted-foreground"} transition-colors`}
          >
            + React
          </button>
          {showReactionPicker && (
            <div className={`absolute ${isOwn ? "right-0" : "left-0"} bottom-full mb-1 z-30 flex items-center gap-0.5 rounded-full glass-strong border border-border/60 shadow-elegant px-2 py-1 animate-fade-in-up`}>
              {QUICK_REACTIONS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => sendReaction(emoji)}
                  className={`text-sm hover:scale-125 transition-transform p-0.5 rounded ${reactions.includes(emoji) ? "bg-primary/20" : ""}`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Reply in thread (groups) */}
        {isGroup && hasMedia && (
          <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border/20">
            <button
              onClick={() => setShowReply((v) => !v)}
              className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] text-muted-foreground hover:bg-surface-hover transition-all"
            >
              <MessageCircle className="h-3 w-3" />
              <span>Reply</span>
            </button>
          </div>
        )}

        {/* Reply input */}
        {showReply && (
          <div className="flex items-center gap-1.5 mt-2">
            <input
              type="text"
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleReply()}
              placeholder="Write a comment..."
              autoFocus
              className="flex-1 rounded-xl bg-background/50 border border-border/40 px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50"
            />
            <button onClick={handleReply} disabled={!replyText.trim()} className="rounded-lg p-1.5 text-primary hover:bg-primary/10 disabled:opacity-30">
              <Send className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ===== Linkified Text (detects URLs and makes them clickable) ===== */
function LinkifiedText({ text, isOwn }: { text: string; isOwn: boolean }) {
  // Handle code blocks first (```code```)
  const parts = text.split(/(```[\s\S]*?```)/g);

  return (
    <>
      {parts.map((part, pi) => {
        if (part.startsWith("```") && part.endsWith("```")) {
          const code = part.slice(3, -3).trim();
          const lang = code.split("\n")[0].match(/^[a-z]+$/i) ? code.split("\n")[0] : "";
          const codeBody = lang ? code.split("\n").slice(1).join("\n") : code;
          return (
            <pre key={pi} className={`mt-1 mb-1 rounded-xl p-2.5 text-[11px] font-mono overflow-x-auto ${isOwn ? "bg-black/30 text-white/90" : "bg-secondary/80 text-foreground"}`}>
              {lang && <span className="text-[8px] text-primary/60 uppercase block mb-1">{lang}</span>}
              <code>{codeBody}</code>
            </pre>
          );
        }
        return <InlineFormat key={pi} text={part} isOwn={isOwn} />;
      })}
    </>
  );
}

function InlineFormat({ text, isOwn }: { text: string; isOwn: boolean }) {
  // Apply markdown: **bold**, *italic*, `code`, @mentions, and URLs
  const formatText = (input: string): React.ReactNode[] => {
    const nodes: React.ReactNode[] = [];
    const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`|(@[\w.-]+)|(https?:\/\/[^\s]+))/g;
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(input)) !== null) {
      if (match.index > lastIndex) {
        nodes.push(<span key={`t${lastIndex}`}>{input.slice(lastIndex, match.index)}</span>);
      }
      if (match[2]) {
        nodes.push(<strong key={`b${match.index}`}>{match[2]}</strong>);
      } else if (match[3]) {
        nodes.push(<em key={`i${match.index}`}>{match[3]}</em>);
      } else if (match[4]) {
        nodes.push(<code key={`c${match.index}`} className="px-1 py-0.5 rounded bg-black/20 text-[11px] font-mono">{match[4]}</code>);
      } else if (match[5]) {
        // @mention
        nodes.push(
          <span key={`m${match.index}`} className={`font-semibold ${isOwn ? "text-white" : "text-primary"}`}>
            {match[5]}
          </span>
        );
      } else if (match[6]) {
        // URL with mini preview
        const url = match[6];
        const domain = url.replace(/https?:\/\//, "").split("/")[0];
        nodes.push(
          <span key={`u${match.index}`} className="inline-block">
            <a href={url} target="_blank" rel="noopener noreferrer"
              className={`underline break-all ${isOwn ? "text-white/90 hover:text-white" : "text-primary hover:text-primary/80"}`}>
              {url.length > 45 ? url.slice(0, 45) + "..." : url}
            </a>
            <span className={`block text-[9px] mt-0.5 ${isOwn ? "text-white/50" : "text-muted-foreground/60"}`}>
              🔗 {domain}
            </span>
          </span>
        );
      }
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < input.length) {
      nodes.push(<span key={`t${lastIndex}`}>{input.slice(lastIndex)}</span>);
    }
    return nodes.length > 0 ? nodes : [<span key="raw">{input}</span>];
  };

  return <>{formatText(text)}</>;
}
