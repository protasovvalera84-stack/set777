import { useState } from "react";
import { X, Check, Image } from "lucide-react";

interface ChatWallpaperProps {
  open: boolean;
  onClose: () => void;
}

const WALLPAPERS = [
  { id: "none", name: "None", bg: "bg-background" },
  { id: "gradient1", name: "Ocean", bg: "bg-gradient-to-br from-blue-900/20 via-cyan-900/10 to-background" },
  { id: "gradient2", name: "Sunset", bg: "bg-gradient-to-br from-orange-900/20 via-pink-900/10 to-background" },
  { id: "gradient3", name: "Forest", bg: "bg-gradient-to-br from-green-900/20 via-emerald-900/10 to-background" },
  { id: "gradient4", name: "Night", bg: "bg-gradient-to-br from-purple-900/20 via-indigo-900/10 to-background" },
  { id: "gradient5", name: "Warm", bg: "bg-gradient-to-br from-amber-900/20 via-yellow-900/10 to-background" },
  { id: "dots", name: "Dots", bg: "bg-background [background-image:radial-gradient(circle,hsl(var(--border))_1px,transparent_1px)] [background-size:20px_20px]" },
  { id: "lines", name: "Lines", bg: "bg-background [background-image:repeating-linear-gradient(0deg,hsl(var(--border)),hsl(var(--border))_1px,transparent_1px,transparent_40px)]" },
];

export function ChatWallpaper({ open, onClose }: ChatWallpaperProps) {
  const [selected, setSelected] = useState(() => localStorage.getItem("meshlink-wallpaper") || "none");

  if (!open) return null;

  const apply = (id: string) => {
    setSelected(id);
    localStorage.setItem("meshlink-wallpaper", id);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-background/70 backdrop-blur-sm" />
      <div onClick={(e) => e.stopPropagation()} className="relative w-full max-w-sm rounded-3xl bg-background border border-border shadow-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-serif italic gradient-text">Chat Wallpaper</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-surface-hover">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {WALLPAPERS.map((w) => (
            <button key={w.id} onClick={() => apply(w.id)}
              className={`relative h-16 rounded-xl border-2 transition-all ${selected === w.id ? "border-primary" : "border-border/30"} ${w.bg} overflow-hidden`}>
              {selected === w.id && (
                <div className="absolute inset-0 flex items-center justify-center bg-primary/20">
                  <Check className="h-4 w-4 text-primary" />
                </div>
              )}
              <p className="absolute bottom-0.5 left-0 right-0 text-[7px] text-center text-muted-foreground">{w.name}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function getWallpaperClass(): string {
  const id = localStorage.getItem("meshlink-wallpaper") || "none";
  const wp = WALLPAPERS.find((w) => w.id === id);
  return wp?.bg || "";
}

// ===== Notification Settings =====
interface NotifSettingsProps {
  open: boolean;
  onClose: () => void;
}

export function NotificationSettings({ open, onClose }: NotifSettingsProps) {
  const [sound, setSound] = useState(() => localStorage.getItem("meshlink-notif-sound") !== "false");
  const [vibrate, setVibrate] = useState(() => localStorage.getItem("meshlink-notif-vibrate") !== "false");
  const [preview, setPreview] = useState(() => localStorage.getItem("meshlink-notif-preview") !== "false");
  const [dmNotif, setDmNotif] = useState(() => localStorage.getItem("meshlink-notif-dm") !== "false");
  const [groupNotif, setGroupNotif] = useState(() => localStorage.getItem("meshlink-notif-group") !== "false");

  if (!open) return null;

  const toggle = (key: string, value: boolean, setter: (v: boolean) => void) => {
    setter(value);
    localStorage.setItem(key, String(value));
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-background/70 backdrop-blur-sm" />
      <div onClick={(e) => e.stopPropagation()} className="relative w-full max-w-xs rounded-3xl bg-background border border-border shadow-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-serif italic gradient-text">Notifications</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-surface-hover">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
        <div className="space-y-3">
          {[
            { label: "Sound", desc: "Play sound for new messages", value: sound, setter: setSound, key: "meshlink-notif-sound" },
            { label: "Vibration", desc: "Vibrate on mobile", value: vibrate, setter: setVibrate, key: "meshlink-notif-vibrate" },
            { label: "Message Preview", desc: "Show text in notifications", value: preview, setter: setPreview, key: "meshlink-notif-preview" },
            { label: "DM Notifications", desc: "Notify for direct messages", value: dmNotif, setter: setDmNotif, key: "meshlink-notif-dm" },
            { label: "Group Notifications", desc: "Notify for group messages", value: groupNotif, setter: setGroupNotif, key: "meshlink-notif-group" },
          ].map((item) => (
            <div key={item.key} className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-foreground">{item.label}</p>
                <p className="text-[10px] text-muted-foreground">{item.desc}</p>
              </div>
              <button onClick={() => toggle(item.key, !item.value, item.setter)}
                className={`relative h-6 w-11 rounded-full transition-all ${item.value ? "bg-primary" : "bg-secondary"}`}>
                <div className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${item.value ? "left-[22px]" : "left-0.5"}`} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
