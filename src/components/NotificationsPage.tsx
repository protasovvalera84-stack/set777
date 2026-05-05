import { useState, useEffect } from "react";
import { X, Bell, Heart, UserPlus, MessageCircle, AtSign, Users, Trash2, AlertTriangle } from "lucide-react";

interface NotificationItem {
  id: string;
  type: "like" | "mention" | "invite" | "join" | "message";
  title: string;
  body: string;
  time: string;
  read: boolean;
}

interface NotificationsPageProps {
  open: boolean;
  onClose: () => void;
}

export function NotificationsPage({ open, onClose }: NotificationsPageProps) {
  const [notifications, setNotifications] = useState<NotificationItem[]>(() => {
    try { return JSON.parse(localStorage.getItem("meshlink-notifications") || "[]"); } catch { return []; }
  });

  const markAllRead = () => {
    const updated = notifications.map((n) => ({ ...n, read: true }));
    setNotifications(updated);
    localStorage.setItem("meshlink-notifications", JSON.stringify(updated));
  };

  const clearAll = () => {
    setNotifications([]);
    localStorage.setItem("meshlink-notifications", "[]");
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  if (!open) return null;

  const getIcon = (type: string) => {
    switch (type) {
      case "like": return <Heart className="h-4 w-4 text-red-400" />;
      case "mention": return <AtSign className="h-4 w-4 text-primary" />;
      case "invite": return <UserPlus className="h-4 w-4 text-accent" />;
      case "join": return <Users className="h-4 w-4 text-online" />;
      default: return <MessageCircle className="h-4 w-4 text-muted-foreground" />;
    }
  };

  return (
    <div className="fixed inset-0 z-[55] flex flex-col bg-background animate-fade-in-up">
      <div className="flex items-center justify-between px-5 py-3 border-b border-border/40">
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-primary" />
          <div>
            <h2 className="text-lg font-serif italic gradient-text">Notifications</h2>
            <p className="text-[10px] text-muted-foreground">{unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {notifications.length > 0 && (
            <>
              <button onClick={markAllRead} className="text-[10px] text-primary hover:underline">Mark all read</button>
              <button onClick={clearAll} className="rounded-lg p-1.5 hover:bg-surface-hover">
                <Trash2 className="h-4 w-4 text-muted-foreground" />
              </button>
            </>
          )}
          <button onClick={onClose} className="rounded-xl p-2 hover:bg-surface-hover">
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <Bell className="h-12 w-12 text-muted-foreground/20" />
            <p className="text-sm text-muted-foreground">No notifications yet</p>
            <p className="text-[10px] text-muted-foreground/60">You'll see likes, mentions, and invites here</p>
          </div>
        ) : (
          <div className="divide-y divide-border/20">
            {notifications.map((n) => (
              <div key={n.id} className={`flex items-start gap-3 px-4 py-3 ${!n.read ? "bg-primary/5" : ""}`}>
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-secondary/50 flex-shrink-0">
                  {getIcon(n.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground">{n.title}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{n.body}</p>
                  <p className="text-[9px] text-muted-foreground/60 mt-0.5">{n.time}</p>
                </div>
                {!n.read && <div className="h-2 w-2 rounded-full bg-primary flex-shrink-0 mt-2" />}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** Add a notification to localStorage */
export function addNotification(type: NotificationItem["type"], title: string, body: string) {
  try {
    const existing = JSON.parse(localStorage.getItem("meshlink-notifications") || "[]");
    const item: NotificationItem = {
      id: `notif-${Date.now()}`,
      type,
      title,
      body,
      time: new Date().toLocaleString(),
      read: false,
    };
    const updated = [item, ...existing].slice(0, 50);
    localStorage.setItem("meshlink-notifications", JSON.stringify(updated));
  } catch { /* ignore */ }
}

// ===== Block User =====
export function BlockUserDialog({ open, onClose, userId, userName, onBlock }: {
  open: boolean;
  onClose: () => void;
  userId: string;
  userName: string;
  onBlock: () => void;
}) {
  if (!open) return null;

  const handleBlock = () => {
    const blocked = JSON.parse(localStorage.getItem("meshlink-blocked") || "[]");
    if (!blocked.includes(userId)) {
      blocked.push(userId);
      localStorage.setItem("meshlink-blocked", JSON.stringify(blocked));
    }
    onBlock();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-background/70 backdrop-blur-sm" />
      <div onClick={(e) => e.stopPropagation()} className="relative w-full max-w-xs rounded-3xl bg-background border border-border shadow-2xl p-5 text-center">
        <AlertTriangle className="h-10 w-10 text-destructive mx-auto mb-3" />
        <h3 className="text-base font-semibold text-foreground mb-1">Block {userName}?</h3>
        <p className="text-xs text-muted-foreground mb-4">They won't be able to send you messages or see your online status.</p>
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 rounded-xl py-2.5 text-xs font-medium bg-secondary text-foreground">Cancel</button>
          <button onClick={handleBlock} className="flex-1 rounded-xl py-2.5 text-xs font-medium bg-destructive text-white">Block</button>
        </div>
      </div>
    </div>
  );
}

// ===== Report =====
export function ReportDialog({ open, onClose, targetId, targetName }: {
  open: boolean;
  onClose: () => void;
  targetId: string;
  targetName: string;
}) {
  const [reason, setReason] = useState("");
  const [sent, setSent] = useState(false);

  if (!open) return null;

  const handleReport = () => {
    const reports = JSON.parse(localStorage.getItem("meshlink-reports") || "[]");
    reports.push({ id: `report-${Date.now()}`, targetId, targetName, reason, time: new Date().toISOString() });
    localStorage.setItem("meshlink-reports", JSON.stringify(reports));
    setSent(true);
    setTimeout(() => { setSent(false); onClose(); }, 1500);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-background/70 backdrop-blur-sm" />
      <div onClick={(e) => e.stopPropagation()} className="relative w-full max-w-xs rounded-3xl bg-background border border-border shadow-2xl p-5">
        {sent ? (
          <div className="text-center py-4">
            <AlertTriangle className="h-10 w-10 text-primary mx-auto mb-2" />
            <p className="text-sm font-medium text-foreground">Report sent</p>
            <p className="text-xs text-muted-foreground">Thank you. We'll review it.</p>
          </div>
        ) : (
          <>
            <h3 className="text-base font-semibold text-foreground mb-1">Report {targetName}</h3>
            <p className="text-xs text-muted-foreground mb-3">Why are you reporting this?</p>
            <div className="space-y-2 mb-4">
              {["Spam", "Harassment", "Inappropriate content", "Fake account", "Other"].map((r) => (
                <button key={r} onClick={() => setReason(r)}
                  className={`w-full text-left rounded-xl px-3 py-2 text-xs border transition-all ${reason === r ? "border-primary bg-primary/10 text-foreground" : "border-border/30 text-muted-foreground hover:bg-surface-hover"}`}>
                  {r}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={onClose} className="flex-1 rounded-xl py-2.5 text-xs font-medium bg-secondary text-foreground">Cancel</button>
              <button onClick={handleReport} disabled={!reason} className={`flex-1 rounded-xl py-2.5 text-xs font-medium ${reason ? "bg-destructive text-white" : "bg-secondary text-muted-foreground"}`}>Report</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
