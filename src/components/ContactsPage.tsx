import { useState, useEffect } from "react";
import { X, Search, UserPlus, MessageCircle, Phone, Trash2 } from "lucide-react";
import { useMesh } from "@/lib/MeshProvider";

interface Contact {
  userId: string;
  displayName: string;
  avatar: string;
  online: boolean;
}

interface ContactsPageProps {
  open: boolean;
  onClose: () => void;
  onStartDm: (userId: string) => void;
}

export function ContactsPage({ open, onClose, onStartDm }: ContactsPageProps) {
  const mesh = useMesh();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [search, setSearch] = useState("");
  const [addSearch, setAddSearch] = useState("");
  const [addResults, setAddResults] = useState<{ userId: string; displayName: string }[]>([]);
  const [showAdd, setShowAdd] = useState(false);

  // Load contacts from DM rooms
  useEffect(() => {
    if (!open || !mesh.client) return;
    const rooms = mesh.client.getRooms();
    const contactMap = new Map<string, Contact>();

    for (const room of rooms) {
      if (room.getMyMembership() !== "join") continue;
      const members = room.getJoinedMembers();
      if (members.length === 2) {
        const other = members.find((m) => m.userId !== mesh.userId);
        if (other && !contactMap.has(other.userId)) {
          const user = mesh.client.getUser(other.userId);
          contactMap.set(other.userId, {
            userId: other.userId,
            displayName: other.name || other.userId.split(":")[0].replace("@", ""),
            avatar: (other.name || "??").split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2),
            online: user?.presence === "online" || user?.currentlyActive === true,
          });
        }
      }
    }

    setContacts(Array.from(contactMap.values()).sort((a, b) => a.displayName.localeCompare(b.displayName)));
  }, [open, mesh.client, mesh.userId]);

  // Search for new contacts
  useEffect(() => {
    if (!addSearch.trim()) { setAddResults([]); return; }
    const timer = setTimeout(async () => {
      const results = await mesh.searchUsers(addSearch.trim());
      setAddResults(results.filter((r) => r.userId !== mesh.userId));
    }, 400);
    return () => clearTimeout(timer);
  }, [addSearch, mesh]);

  if (!open) return null;

  const filtered = search
    ? contacts.filter((c) => c.displayName.toLowerCase().includes(search.toLowerCase()) || c.userId.toLowerCase().includes(search.toLowerCase()))
    : contacts;

  return (
    <div className="fixed inset-0 z-[55] flex flex-col bg-background animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border/40">
        <div>
          <h2 className="text-lg font-serif italic gradient-text">Contacts</h2>
          <p className="text-[11px] text-muted-foreground">{contacts.length} contacts</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowAdd(true)} className="rounded-xl p-2 hover:bg-surface-hover" title="Add contact">
            <UserPlus className="h-4 w-4 text-primary" />
          </button>
          <button onClick={onClose} className="rounded-xl p-2 hover:bg-surface-hover">
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="px-4 py-3">
        <div className="flex items-center gap-2.5 rounded-2xl glass border border-border/50 px-4 py-2.5">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search contacts..."
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
          />
        </div>
      </div>

      {/* Contact list */}
      <div className="flex-1 overflow-y-auto px-4">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <MessageCircle className="h-12 w-12 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">{search ? "No contacts found" : "No contacts yet"}</p>
            <button onClick={() => setShowAdd(true)} className="text-xs text-primary hover:underline">
              Find people to chat with
            </button>
          </div>
        ) : (
          <div className="space-y-1">
            {filtered.map((contact) => (
              <div
                key={contact.userId}
                className="flex items-center gap-3 rounded-2xl px-3 py-2.5 hover:bg-surface-hover transition-all"
              >
                <div className="relative">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-primary-glow/5 text-xs font-bold text-primary border border-primary/20">
                    {contact.avatar}
                  </div>
                  {contact.online && (
                    <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card bg-online" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{contact.displayName}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{contact.userId}</p>
                </div>
                <button
                  onClick={() => { onStartDm(contact.userId); onClose(); }}
                  className="rounded-xl p-2 hover:bg-primary/10 text-primary"
                  title="Message"
                >
                  <MessageCircle className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add contact dialog */}
      {showAdd && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" onClick={() => setShowAdd(false)}>
          <div className="absolute inset-0 bg-background/70 backdrop-blur-sm" />
          <div onClick={(e) => e.stopPropagation()} className="relative w-full max-w-sm rounded-3xl glass-strong border border-border/60 shadow-elegant p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-serif italic gradient-text">Find People</h3>
              <button onClick={() => setShowAdd(false)} className="rounded-lg p-1.5 hover:bg-surface-hover">
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
            <div className="flex items-center gap-2 rounded-2xl glass border border-border/50 px-3 py-2.5 mb-3">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                value={addSearch}
                onChange={(e) => setAddSearch(e.target.value)}
                placeholder="Search by name or username..."
                autoFocus
                className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
              />
            </div>
            <div className="max-h-60 overflow-y-auto space-y-1">
              {addResults.map((user) => (
                <button
                  key={user.userId}
                  onClick={() => { onStartDm(user.userId); setShowAdd(false); onClose(); }}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-surface-hover transition-all"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-primary-glow/5 text-xs font-bold text-primary border border-primary/20">
                    {user.displayName.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2) || "??"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{user.displayName}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{user.userId}</p>
                  </div>
                  <MessageCircle className="h-4 w-4 text-primary" />
                </button>
              ))}
              {addSearch && addResults.length === 0 && (
                <p className="text-center text-xs text-muted-foreground py-4">No users found</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
