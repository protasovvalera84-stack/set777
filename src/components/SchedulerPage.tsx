import { useState, useEffect } from "react";
import { X, Plus, Calendar, Clock, Bell, Trash2, Check } from "lucide-react";

interface Reminder {
  id: string;
  text: string;
  date: string;
  time: string;
  notified: boolean;
}

interface SchedulerPageProps {
  open: boolean;
  onClose: () => void;
}

export function SchedulerPage({ open, onClose }: SchedulerPageProps) {
  const [reminders, setReminders] = useState<Reminder[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("meshlink-reminders") || "[]");
    } catch { return []; }
  });
  const [showAdd, setShowAdd] = useState(false);
  const [newText, setNewText] = useState("");
  const [newDate, setNewDate] = useState("");
  const [newTime, setNewTime] = useState("");

  // Save to localStorage
  useEffect(() => {
    localStorage.setItem("meshlink-reminders", JSON.stringify(reminders));
  }, [reminders]);

  // Check for due reminders every 30 seconds
  useEffect(() => {
    if (!open) return;
    const interval = setInterval(() => {
      const now = new Date();
      setReminders((prev) =>
        prev.map((r) => {
          if (r.notified) return r;
          const reminderTime = new Date(`${r.date}T${r.time}`);
          if (reminderTime <= now) {
            // Show notification
            if (Notification.permission === "granted") {
              new Notification("Meshlink Reminder", { body: r.text, icon: "/icons/icon-256.png" });
            }
            return { ...r, notified: true };
          }
          return r;
        })
      );
    }, 30000);
    return () => clearInterval(interval);
  }, [open]);

  const addReminder = () => {
    if (!newText.trim() || !newDate || !newTime) return;
    const reminder: Reminder = {
      id: `rem-${Date.now()}`,
      text: newText.trim(),
      date: newDate,
      time: newTime,
      notified: false,
    };
    setReminders((prev) => [...prev, reminder]);
    setNewText("");
    setNewDate("");
    setNewTime("");
    setShowAdd(false);
  };

  const deleteReminder = (id: string) => {
    setReminders((prev) => prev.filter((r) => r.id !== id));
  };

  if (!open) return null;

  const upcoming = reminders.filter((r) => !r.notified).sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));
  const past = reminders.filter((r) => r.notified);

  return (
    <div className="fixed inset-0 z-[55] flex flex-col bg-background animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border/40">
        <div>
          <h2 className="text-lg font-serif italic gradient-text">Scheduler</h2>
          <p className="text-[11px] text-muted-foreground">{upcoming.length} upcoming reminders</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowAdd(true)} className="rounded-xl p-2 hover:bg-surface-hover" title="Add reminder">
            <Plus className="h-4 w-4 text-primary" />
          </button>
          <button onClick={onClose} className="rounded-xl p-2 hover:bg-surface-hover">
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {/* Upcoming */}
        {upcoming.length > 0 && (
          <div>
            <p className="text-[9px] font-mono uppercase tracking-[0.15em] text-muted-foreground mb-2">Upcoming</p>
            <div className="space-y-2">
              {upcoming.map((r) => (
                <div key={r.id} className="flex items-center gap-3 rounded-2xl glass border border-border/40 px-4 py-3">
                  <Bell className="h-4 w-4 text-primary flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground">{r.text}</p>
                    <p className="text-[10px] text-muted-foreground flex items-center gap-1.5 mt-0.5">
                      <Calendar className="h-3 w-3" /> {r.date}
                      <Clock className="h-3 w-3 ml-1" /> {r.time}
                    </p>
                  </div>
                  <button onClick={() => deleteReminder(r.id)} className="p-1.5 hover:bg-destructive/10 rounded-lg">
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Past */}
        {past.length > 0 && (
          <div>
            <p className="text-[9px] font-mono uppercase tracking-[0.15em] text-muted-foreground mb-2">Completed</p>
            <div className="space-y-2">
              {past.map((r) => (
                <div key={r.id} className="flex items-center gap-3 rounded-2xl glass border border-border/20 px-4 py-3 opacity-60">
                  <Check className="h-4 w-4 text-online flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground line-through">{r.text}</p>
                    <p className="text-[10px] text-muted-foreground">{r.date} {r.time}</p>
                  </div>
                  <button onClick={() => deleteReminder(r.id)} className="p-1.5 hover:bg-destructive/10 rounded-lg">
                    <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {upcoming.length === 0 && past.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <Calendar className="h-12 w-12 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">No reminders yet</p>
            <button onClick={() => setShowAdd(true)} className="text-xs text-primary hover:underline">
              Create your first reminder
            </button>
          </div>
        )}
      </div>

      {/* Add reminder dialog */}
      {showAdd && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" onClick={() => setShowAdd(false)}>
          <div className="absolute inset-0 bg-background/70 backdrop-blur-sm" />
          <div onClick={(e) => e.stopPropagation()} className="relative w-full max-w-sm rounded-3xl glass-strong border border-border/60 shadow-elegant p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-serif italic gradient-text">New Reminder</h3>
              <button onClick={() => setShowAdd(false)} className="rounded-lg p-1.5 hover:bg-surface-hover">
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-mono uppercase text-muted-foreground mb-1 block">What to remind</label>
                <input
                  type="text"
                  value={newText}
                  onChange={(e) => setNewText(e.target.value)}
                  placeholder="Meeting, call, task..."
                  autoFocus
                  className="w-full rounded-2xl glass border border-border/50 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 bg-transparent"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-mono uppercase text-muted-foreground mb-1 block">Date</label>
                  <input
                    type="date"
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                    className="w-full rounded-xl glass border border-border/50 px-3 py-2 text-xs text-foreground outline-none focus:border-primary/50 bg-transparent"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-mono uppercase text-muted-foreground mb-1 block">Time</label>
                  <input
                    type="time"
                    value={newTime}
                    onChange={(e) => setNewTime(e.target.value)}
                    className="w-full rounded-xl glass border border-border/50 px-3 py-2 text-xs text-foreground outline-none focus:border-primary/50 bg-transparent"
                  />
                </div>
              </div>
              <button
                onClick={addReminder}
                disabled={!newText.trim() || !newDate || !newTime}
                className={`w-full rounded-2xl py-3 text-sm font-semibold transition-all ${
                  newText.trim() && newDate && newTime ? "gradient-primary text-primary-foreground shadow-glow hover:scale-[1.02]" : "bg-secondary text-muted-foreground cursor-not-allowed"
                }`}
              >
                Set Reminder
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
