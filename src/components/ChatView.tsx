import { useState, useRef, useEffect, useCallback } from "react";
import {
  Phone, Video, MoreVertical, Paperclip, Smile, Send,
  Lock, Hash, Users, Sparkles, Mic, ArrowLeft,
  Image, Film, Music, X, Download, Heart, MessageCircle, ThumbsDown,
  Timer, Forward, Copy, Check,
} from "lucide-react";
import { Chat, Message, MediaAttachment, Topic } from "@/data/mockData";
import { TopicsBar } from "@/components/TopicsBar";
import { useMesh } from "@/lib/MeshProvider";
import { EmojiPicker } from "@/components/EmojiPicker";
import { GifPicker } from "@/components/GifPicker";
import { CreatePollDialog } from "@/components/Poll";

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
  const [input, setInput] = useState("");
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
  const [contextMsg, setContextMsg] = useState<string | null>(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [gifOpen, setGifOpen] = useState(false);
  const [pinnedMsg, setPinnedMsg] = useState<string | null>(() => {
    try {
      return localStorage.getItem(`meshlink-pin-${chat.id}`) || null;
    } catch { return null; }
  });
  const [pollOpen, setPollOpen] = useState(false);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
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

  // Send typing indicator when user types
  const handleInputChange = (value: string) => {
    setInput(value);
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
    <div className="relative flex h-full flex-1 flex-col bg-background overflow-hidden">
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
      <div className="relative z-10 flex items-center justify-between border-b border-border/40 px-4 md:px-6 py-3.5 glass-strong">
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
        <div className="flex items-center gap-1">
          {/* Disappearing messages timer */}
          <div className="relative">
            <button
              onClick={() => setShowTimerMenu((v) => !v)}
              className={`rounded-xl p-2.5 hover:bg-surface-hover transition-all hover:scale-105 ${disappearTimer ? "text-primary" : ""}`}
              title="Disappearing messages"
            >
              <Timer className={`h-4 w-4 ${disappearTimer ? "text-primary" : "text-muted-foreground"}`} />
            </button>
            {showTimerMenu && (
              <div className="absolute right-0 top-full mt-1 z-50 rounded-2xl glass-strong border border-border/60 shadow-elegant p-2 w-48 animate-fade-in-up">
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
          </div>

          {(chat.type === "dm" || chat.type === "group") && onCall && (
            <>
              <button
                onClick={() => onCall("audio")}
                className="rounded-xl p-2.5 hover:bg-surface-hover transition-all hover:scale-105 hover:text-primary"
                title="Audio call"
              >
                <Phone className="h-4 w-4 text-muted-foreground" />
              </button>
              <button
                onClick={() => onCall("video")}
                className="rounded-xl p-2.5 hover:bg-surface-hover transition-all hover:scale-105 hover:text-primary"
                title="Video call"
              >
                <Video className="h-4 w-4 text-muted-foreground" />
              </button>
            </>
          )}
          {(chat.type === "group" || chat.type === "channel") && onSettingsClick && (
            <button
              onClick={onSettingsClick}
              className="rounded-xl p-2.5 hover:bg-surface-hover transition-all hover:scale-105"
              title="Settings"
            >
              <MoreVertical className="h-4 w-4 text-muted-foreground" />
            </button>
          )}
          {chat.type === "dm" && (
            <button
              onClick={onDmSettingsClick}
              className="rounded-xl p-2.5 hover:bg-surface-hover transition-all hover:scale-105"
              title="Chat settings"
            >
              <MoreVertical className="h-4 w-4 text-muted-foreground" />
            </button>
          )}
        </div>
      </div>

      {/* E2EE banner */}
      <div className="relative z-10 flex items-center justify-center gap-2 py-2 bg-gradient-to-r from-primary/5 via-primary/10 to-accent/5 border-b border-border/30">
        <Lock className="h-3 w-3 text-primary" />
        <span className="text-[10px] font-mono uppercase tracking-[0.15em] gradient-text font-semibold">
          end-to-end encrypted - Matrix protocol
        </span>
        <Sparkles className="h-3 w-3 text-accent" />
      </div>

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
      <div className="relative z-10 flex-1 overflow-y-auto px-4 md:px-6 py-6 scrollbar-thin">
        <div className="mx-auto max-w-3xl space-y-4">
          {(() => {
            const hasTopics = (chat.type === "group" || chat.type === "channel") && chat.topics && chat.topics.length > 0;
            const filtered = hasTopics && activeTopic !== null
              ? chat.messages.filter((m) => m.topicId === activeTopic || m.senderId === "system")
              : chat.messages;
            return filtered.length > 0 ? (
              filtered.map((msg, i) => (
                <MessageBubble key={msg.id} message={msg} index={i} chatType={chat.type} roomId={chat.id} onForward={handleForward} onPin={(text) => { setPinnedMsg(text); localStorage.setItem(`meshlink-pin-${chat.id}`, text); }} onReply={setReplyTo} />
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Hash className="h-8 w-8 text-muted-foreground/30 mb-3" />
                <p className="text-sm text-muted-foreground">No messages in this topic yet</p>
                <p className="text-[11px] text-muted-foreground/60 mt-1">Be the first to write something</p>
              </div>
            );
          })()}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Pending media preview */}
      {pendingMedia.length > 0 && (
        <div className="relative z-10 border-t border-border/30 px-4 md:px-6 py-3 glass">
          <div className="mx-auto max-w-3xl flex gap-2 overflow-x-auto scrollbar-thin pb-1">
            {pendingMedia.map((m) => (
              <div key={m.id} className="relative flex-shrink-0 group">
                {m.type === "image" ? (
                  <img src={m.url} alt={m.name} className="h-16 w-16 rounded-xl object-cover border border-border/40" />
                ) : m.type === "video" ? (
                  <div className="h-16 w-16 rounded-xl bg-secondary border border-border/40 flex items-center justify-center">
                    <Film className="h-6 w-6 text-primary" />
                  </div>
                ) : (
                  <div className="h-16 w-16 rounded-xl bg-secondary border border-border/40 flex items-center justify-center">
                    <Music className="h-6 w-6 text-accent" />
                  </div>
                )}
                <button
                  onClick={() => removePendingMedia(m.id)}
                  className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="h-3 w-3" />
                </button>
                <p className="text-[9px] text-muted-foreground truncate w-16 mt-0.5">{m.name}</p>
              </div>
            ))}
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
      <div className="relative z-10 border-t border-border/40 px-4 md:px-6 py-3 md:py-4 glass-strong">
        <div className="mx-auto flex max-w-3xl items-end gap-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="rounded-2xl p-2.5 md:p-3 hover:bg-surface-hover transition-all hover:scale-105 hover:text-primary"
          >
            <Paperclip className="h-4 w-4 text-muted-foreground" />
          </button>
          {(chat.type === "group" || chat.type === "channel") && (
            <button
              onClick={() => setPollOpen(true)}
              className="rounded-2xl p-2.5 md:p-3 hover:bg-surface-hover transition-all hover:scale-105 hover:text-primary"
              title="Create poll"
            >
              <span className="text-[10px] font-bold text-muted-foreground">📊</span>
            </button>
          )}
          <div className="group flex flex-1 items-center gap-2 rounded-2xl glass border border-border/50 px-3 md:px-4 py-2.5 md:py-3 transition-all focus-within:border-primary/50 focus-within:shadow-glow">
            <input
              type="text"
              placeholder="Type a secure message..."
              value={input}
              onChange={(e) => handleInputChange(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
            />
            {/* Quick media buttons */}
            <button
              onClick={() => {
                if (fileInputRef.current) {
                  fileInputRef.current.accept = "image/*";
                  fileInputRef.current.click();
                  fileInputRef.current.accept = "image/*,video/*,audio/*";
                }
              }}
              className="hidden sm:flex hover:text-primary transition-colors"
              title="Send photo"
            >
              <Image className="h-4 w-4 text-muted-foreground" />
            </button>
            <button onClick={() => { setGifOpen((v) => !v); setEmojiOpen(false); }} className="hidden sm:flex hover:text-primary transition-colors" title="GIF">
              <span className="text-[9px] font-bold text-muted-foreground border border-muted-foreground/40 rounded px-1">GIF</span>
            </button>
            <button onClick={() => setEmojiOpen((v) => !v)} className="hidden sm:flex hover:text-primary transition-colors">
              <Smile className="h-4 w-4 text-muted-foreground" />
            </button>
            <button
              onClick={isRecording ? stopRecording : startRecording}
              className={`hidden sm:flex hover:text-primary transition-colors ${isRecording ? "text-destructive animate-pulse" : ""}`}
              title={isRecording ? `Recording ${recordingDuration}s - click to stop` : "Voice message"}
            >
              <Mic className={`h-4 w-4 ${isRecording ? "text-destructive" : "text-muted-foreground"}`} />
            </button>
          </div>
          <button
            onClick={handleSend}
            className={`rounded-2xl p-2.5 md:p-3 transition-all hover:scale-105 ${
              input.trim() || pendingMedia.length > 0
                ? "gradient-primary text-primary-foreground shadow-glow"
                : "bg-secondary text-muted-foreground"
            }`}
          >
            <Send className="h-4 w-4" />
          </button>
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
        <audio src={attachment.url} controls className="w-full h-8" />
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

  const [reaction, setReaction] = useState<"like" | "dislike" | null>(null);
  const [showReply, setShowReply] = useState(false);
  const [replyText, setReplyText] = useState("");

  const sendReaction = (key: string) => {
    if (!mesh.client || !roomId) return;
    mesh.client.sendEvent(roomId, "m.reaction" as Parameters<typeof mesh.client.sendEvent>[1], {
      "m.relates_to": {
        rel_type: "m.annotation",
        event_id: message.id,
        key,
      },
    }).catch(() => {});
  };

  const handleLike = () => {
    if (reaction === "like") {
      setReaction(null);
    } else {
      setReaction("like");
      sendReaction("\u2764\ufe0f");
    }
  };

  const handleDislike = () => {
    if (reaction === "dislike") {
      setReaction(null);
    } else {
      setReaction("dislike");
      sendReaction("\ud83d\udc4e");
    }
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
      className={`flex ${isOwn ? "justify-end" : "justify-start"} animate-fade-in-up`}
      style={{ animationDelay: `${index * 30}ms` }}
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
        {message.text && (
          <p className={`text-sm whitespace-pre-line leading-relaxed ${isOwn ? "text-white" : "text-foreground"}`}>
            {message.text}
          </p>
        )}
        {message.media && message.media.map((m) => (
          <MediaDisplay key={m.id} attachment={m} />
        ))}
        <p className={`mt-1 text-[10px] ${isOwn ? "text-white/70" : "text-muted-foreground"} text-right font-mono`}>
          {message.timestamp}
          {isOwn && (
            <span className="ml-1">{message.read ? "\u2713\u2713" : "\u2713"}</span>
          )}
        </p>

        {/* Forward, Pin & Reply buttons */}
        {message.text && (
          <div className={`mt-1 flex items-center gap-2 text-[9px] ${isOwn ? "text-white/50" : "text-muted-foreground/50"}`}>
            {onReply && (
              <button onClick={() => onReply(message)} className={`flex items-center gap-0.5 ${isOwn ? "hover:text-white/80" : "hover:text-muted-foreground"} transition-colors`}>
                ↩ Reply
              </button>
            )}
            {onForward && (
              <button onClick={() => onForward(message)} className={`flex items-center gap-0.5 ${isOwn ? "hover:text-white/80" : "hover:text-muted-foreground"} transition-colors`}>
                <Forward className="h-2.5 w-2.5" /> Forward
              </button>
            )}
            {onPin && (
              <button onClick={() => onPin(message.text)} className={`flex items-center gap-0.5 ${isOwn ? "hover:text-white/80" : "hover:text-muted-foreground"} transition-colors`}>
                <Copy className="h-2.5 w-2.5" /> Pin
              </button>
            )}
          </div>
        )}

        {/* Reactions bar for media in groups/channels */}
        {isGroup && hasMedia && (
          <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border/20">
            <button
              onClick={handleLike}
              className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] transition-all ${
                reaction === "like" ? "bg-red-500/20 text-red-400" : "hover:bg-surface-hover text-muted-foreground"
              }`}
            >
              <Heart className={`h-3 w-3 ${reaction === "like" ? "fill-red-400" : ""}`} />
              <span>{reaction === "like" ? "Liked" : "Like"}</span>
            </button>
            <button
              onClick={() => setShowReply((v) => !v)}
              className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] text-muted-foreground hover:bg-surface-hover transition-all"
            >
              <MessageCircle className="h-3 w-3" />
              <span>Reply</span>
            </button>
            <button
              onClick={handleDislike}
              className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] transition-all ${
                reaction === "dislike" ? "bg-blue-500/20 text-blue-400" : "hover:bg-surface-hover text-muted-foreground"
              }`}
            >
              <ThumbsDown className={`h-3 w-3 ${reaction === "dislike" ? "fill-blue-400" : ""}`} />
              <span>{reaction === "dislike" ? "Disliked" : "Dislike"}</span>
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
