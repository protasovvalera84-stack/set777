import { useState } from "react";
import { X, Search, ChevronRight, MessageCircle, Shield, Phone, Settings, Smartphone, Zap } from "lucide-react";

interface HelpSection {
  icon: React.ReactNode;
  title: string;
  items: { q: string; a: string }[];
}

interface HelpPageProps {
  open: boolean;
  onClose: () => void;
}

export function HelpPage({ open, onClose }: HelpPageProps) {
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  if (!open) return null;

  const sections: HelpSection[] = [
    {
      icon: <MessageCircle className="h-4 w-4 text-primary" />,
      title: "Messaging",
      items: [
        { q: "How to send a message?", a: "Type in the input field and press Enter or tap the Send button." },
        { q: "How to reply to a message?", a: "Tap the ↩ button on any message, or swipe right on mobile." },
        { q: "How to edit a message?", a: "Double-click your message on desktop, or tap ✏️ button." },
        { q: "How to delete a message?", a: "Tap 🗑️ on your message. It deletes for everyone." },
        { q: "How to forward a message?", a: "Tap ↪ on any message and select the chat." },
        { q: "How to send GIFs?", a: "Tap the GIF button in the media toolbar above the input." },
        { q: "How to send voice messages?", a: "Tap the 🎤 microphone button. Tap again to stop and send." },
        { q: "How to use emoji reactions?", a: "Tap '+ React' below any message, or double-tap on mobile for ❤️." },
      ],
    },
    {
      icon: <Shield className="h-4 w-4 text-primary" />,
      title: "Security & Privacy",
      items: [
        { q: "Is my data encrypted?", a: "Yes! All messages are end-to-end encrypted using Matrix Olm/Megolm protocol." },
        { q: "How to set a PIN lock?", a: "Go to Settings → PIN Lock → Set a 4-digit PIN." },
        { q: "How to verify encryption?", a: "In DM settings, tap 'Verify Encryption' to compare emoji keys." },
        { q: "How to check security score?", a: "Go to Settings → Security Audit to see your score." },
        { q: "Can the server read my messages?", a: "No. Messages are encrypted on your device before sending." },
      ],
    },
    {
      icon: <Phone className="h-4 w-4 text-primary" />,
      title: "Calls",
      items: [
        { q: "How to make a call?", a: "Tap the 📞 phone icon in the chat header." },
        { q: "How to share screen?", a: "During a call, tap the Monitor button to share your screen." },
        { q: "How to start a group call?", a: "In a group chat, open ⋮ menu → Group Call." },
      ],
    },
    {
      icon: <Settings className="h-4 w-4 text-primary" />,
      title: "Settings",
      items: [
        { q: "How to change theme?", a: "Go to Settings → Edit Profile → Appearance section." },
        { q: "How to change font size?", a: "Settings → Edit Profile → Font Size slider." },
        { q: "How to export settings?", a: "Settings → Export/Import → Export Settings." },
        { q: "How to set auto-reply?", a: "Tap 🤖 in the sidebar toolbar to configure auto-reply." },
        { q: "How to set a status?", a: "Go to Settings → Status section at the top." },
      ],
    },
    {
      icon: <Smartphone className="h-4 w-4 text-primary" />,
      title: "Mobile",
      items: [
        { q: "How to install on Android?", a: "Register on the web, APK downloads automatically. Or use PWA." },
        { q: "How to install on iOS?", a: "Open in Safari → Share → Add to Home Screen." },
        { q: "Swipe gestures?", a: "Swipe right on a message to reply. Double-tap for ❤️ reaction." },
      ],
    },
    {
      icon: <Zap className="h-4 w-4 text-primary" />,
      title: "Keyboard Shortcuts",
      items: [
        { q: "Search in chat", a: "Ctrl+F (or Cmd+F on Mac)" },
        { q: "Show all shortcuts", a: "Press ? key" },
        { q: "Send message", a: "Enter" },
        { q: "Paste image", a: "Ctrl+V with image in clipboard" },
      ],
    },
  ];

  const allItems = sections.flatMap((s) => s.items.map((i) => ({ ...i, section: s.title })));
  const filtered = search ? allItems.filter((i) => i.q.toLowerCase().includes(search.toLowerCase()) || i.a.toLowerCase().includes(search.toLowerCase())) : [];

  return (
    <div className="fixed inset-0 z-[55] flex flex-col bg-background animate-fade-in-up">
      <div className="flex items-center justify-between px-5 py-3 border-b border-border/40 glass-strong">
        <h2 className="text-lg font-serif italic gradient-text">Help Center</h2>
        <button onClick={onClose} className="rounded-xl p-2 hover:bg-surface-hover">
          <X className="h-5 w-5 text-muted-foreground" />
        </button>
      </div>

      {/* Search */}
      <div className="px-4 py-3 border-b border-border/30">
        <div className="flex items-center gap-2 rounded-2xl glass border border-border/50 px-3 py-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search help..." className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 scrollbar-thin">
        {search ? (
          filtered.length > 0 ? (
            <div className="space-y-2">
              {filtered.map((item, i) => (
                <div key={i} className="rounded-xl glass border border-border/40 px-4 py-3">
                  <p className="text-xs font-medium text-foreground">{item.q}</p>
                  <p className="text-[11px] text-muted-foreground mt-1">{item.a}</p>
                  <p className="text-[9px] text-primary/60 mt-1">{item.section}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-sm text-muted-foreground py-8">No results found</p>
          )
        ) : (
          sections.map((section) => (
            <div key={section.title}>
              <button onClick={() => setExpanded(expanded === section.title ? null : section.title)} className="flex w-full items-center gap-2 mb-2">
                {section.icon}
                <p className="text-sm font-medium text-foreground flex-1 text-left">{section.title}</p>
                <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${expanded === section.title ? "rotate-90" : ""}`} />
              </button>
              {expanded === section.title && (
                <div className="space-y-1.5 ml-6">
                  {section.items.map((item, i) => (
                    <div key={i} className="rounded-xl glass border border-border/30 px-3 py-2">
                      <p className="text-xs font-medium text-foreground">{item.q}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{item.a}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
