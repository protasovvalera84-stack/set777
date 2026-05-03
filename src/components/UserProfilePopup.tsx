import { useState } from "react";
import { X, MessageCircle, Phone, Shield, Clock, Users } from "lucide-react";

interface UserProfilePopupProps {
  open: boolean;
  onClose: () => void;
  userId: string;
  userName: string;
  avatar: string;
  online?: boolean;
  onMessage?: () => void;
}

export function UserProfilePopup({ open, onClose, userId, userName, avatar, online, onMessage }: UserProfilePopupProps) {
  if (!open) return null;

  const initials = avatar || userName.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
  const status = localStorage.getItem("meshlink-status") || "";

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-background/60 backdrop-blur-sm" />
      <div onClick={(e) => e.stopPropagation()} className="relative w-full sm:max-w-xs rounded-t-3xl sm:rounded-3xl glass-strong border border-border/60 shadow-elegant overflow-hidden animate-fade-in-up">
        {/* Header with gradient */}
        <div className="h-20 bg-gradient-to-br from-primary/30 via-primary/20 to-accent/10 relative">
          <button onClick={onClose} className="absolute top-3 right-3 rounded-lg p-1 bg-black/20 hover:bg-black/40">
            <X className="h-4 w-4 text-white" />
          </button>
        </div>

        {/* Avatar */}
        <div className="flex justify-center -mt-10">
          <div className="relative">
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/40 to-primary-glow/20 text-xl font-bold text-primary border-4 border-background shadow-lg">
              {initials}
            </div>
            {online && (
              <div className="absolute -bottom-0.5 -right-0.5 h-5 w-5 rounded-full border-3 border-background bg-online shadow-lg" />
            )}
          </div>
        </div>

        {/* Info */}
        <div className="px-5 pt-3 pb-5 text-center">
          <h3 className="text-lg font-semibold text-foreground">{userName}</h3>
          <p className="text-xs text-muted-foreground font-mono">{userId}</p>
          {online !== undefined && (
            <p className={`text-[10px] mt-1 ${online ? "text-online" : "text-muted-foreground"}`}>
              {online ? "Online now" : "Last seen recently"}
            </p>
          )}

          {/* Stats */}
          <div className="flex items-center justify-center gap-4 mt-3">
            <div className="text-center">
              <Shield className="h-4 w-4 text-primary mx-auto mb-0.5" />
              <p className="text-[9px] text-muted-foreground">E2E Encrypted</p>
            </div>
            <div className="text-center">
              <Clock className="h-4 w-4 text-accent mx-auto mb-0.5" />
              <p className="text-[9px] text-muted-foreground">Matrix Protocol</p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 mt-4">
            {onMessage && (
              <button onClick={() => { onMessage(); onClose(); }} className="flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-medium gradient-primary text-primary-foreground shadow-glow">
                <MessageCircle className="h-3.5 w-3.5" /> Message
              </button>
            )}
            <button className="flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-medium bg-secondary text-foreground hover:bg-surface-hover">
              <Phone className="h-3.5 w-3.5" /> Call
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
