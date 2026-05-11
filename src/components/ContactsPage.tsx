import { useState, useEffect } from "react";
import { X, Search, UserPlus, MessageCircle, UserCheck, UserX, Users, Clock, Check } from "lucide-react";
import { useMesh } from "@/lib/MeshProvider";

interface Contact {
  userId: string;
  displayName: string;
  avatar: string;
  online: boolean;
  isFriend: boolean;
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
  const [tab, setTab] = useState<"friends" | "all" | "requests">("friends");
  const [requestSent, setRequestSent] = useState<Set<string>>(new Set());

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
            isFriend: mesh.isFriend(other.userId),
          });
        }
      }
    }

    setContacts(Array.from(contactMap.values()).sort((a, b) => a.displayName.localeCompare(b.displayName)));
  }, [open, mesh.client, mesh.userId, mesh.friends, mesh.isFriend]);

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

  const friendContacts = contacts.filter((c) => c.isFriend);
  const allContacts = contacts;
  const filtered = (tab === "friends" ? friendContacts : allContacts).filter((c) =>
    !search || c.displayName.toLowerCase().includes(search.toLowerCase()) || c.userId.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-[55] flex flex-col bg-background animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border/40">
        <div>
          <h2 className="text-lg font-serif italic gradient-text">Contacts</h2>
          <p className="text-[11px] text-muted-foreground">
            {mesh.friends.length} friends, {contacts.length} contacts
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowAdd(true)} className="rounded-xl p-2 hover:bg-surface-hover" title="Add friend">
            <UserPlus className="h-4 w-4 text-primary" />
          </button>
          <button onClick={onClose} className="rounded-xl p-2 hover:bg-surface-hover">
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* Tabs: Friends / All / Requests */}
      <div className="flex gap-1 px-4 py-2 border-b border-border/30">
        {([
          { key: "friends" as const, label: "Friends", icon: Users, count: friendContacts.length },
          { key: "all" as const, label: "All", icon: MessageCircle, count: allContacts.length },
          { key: "requests" as const, label: "Requests", icon: Clock, count: mesh.friendRequests.length },
        ]).map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-medium transition-all ${
              tab === t.key ? "gradient-primary text-primary-foreground shadow-glow" : "text-muted-foreground hover:bg-surface-hover"
            }`}>
            <t.icon className="h-3 w-3" />
            {t.label}
            {t.count > 0 && <span className={`text-[9px] ${tab === t.key ? "text-primary-foreground/70" : "text-muted-foreground/60"}`}>{t.count}</span>}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="px-4 py-3">
        <div className="flex items-center gap-2.5 rounded-2xl glass border border-border/50 px-4 py-2.5">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder={tab === "requests" ? "Search requests..." : "Search contacts..."}
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none" />
        </div>
      </div>

      {/* Friend Requests tab */}
      {tab === "requests" ? (
        <div className="flex-1 overflow-y-auto px-4">
          {mesh.friendRequests.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3">
              <Clock className="h-12 w-12 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">No pending requests</p>
            </div>
          ) : (
            <div className="space-y-1">
              {mesh.friendRequests.map((req) => (
                <div key={req.from} className="flex items-center gap-3 rounded-2xl px-3 py-2.5 hover:bg-surface-hover transition-all">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-primary-glow/5 text-xs font-bold text-primary border border-primary/20">
                    {req.displayName.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{req.displayName}</p>
                    <p className="text-[10px] text-muted-foreground">wants to be your friend</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => mesh.acceptFriend(req.from)}
                      className="rounded-xl px-3 py-1.5 text-xs font-medium gradient-primary text-primary-foreground shadow-glow">
                      Accept
                    </button>
                    <button onClick={() => mesh.rejectFriend(req.from)}
                      className="rounded-xl p-1.5 hover:bg-destructive/10 text-destructive">
                      <UserX className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* Contact list */
        <div className="flex-1 overflow-y-auto px-4">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3">
              <Users className="h-12 w-12 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">{search ? "No contacts found" : tab === "friends" ? "No friends yet" : "No contacts yet"}</p>
              <button onClick={() => setShowAdd(true)} className="text-xs text-primary hover:underline">Find people</button>
            </div>
          ) : (
            <div className="space-y-1">
              {filtered.map((contact) => (
                <div key={contact.userId} className="flex items-center gap-3 rounded-2xl px-3 py-2.5 hover:bg-surface-hover transition-all">
                  <div className="relative">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-primary-glow/5 text-xs font-bold text-primary border border-primary/20">
                      {contact.avatar}
                    </div>
                    {contact.online && <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card bg-online" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-medium text-foreground truncate">{contact.displayName}</p>
                      {contact.isFriend && <UserCheck className="h-3 w-3 text-primary flex-shrink-0" />}
                    </div>
                    <p className="text-[10px] text-muted-foreground truncate">{contact.userId}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    {!contact.isFriend && (
                      <button onClick={() => { mesh.addFriend(contact.userId); setRequestSent((s) => new Set(s).add(contact.userId)); }}
                        disabled={requestSent.has(contact.userId)}
                        className={`rounded-xl px-2.5 py-1.5 text-[10px] font-medium transition-all ${
                          requestSent.has(contact.userId) ? "bg-secondary text-muted-foreground" : "bg-primary/10 text-primary hover:bg-primary/20"
                        }`}>
                        {requestSent.has(contact.userId) ? "Sent" : "Add"}
                      </button>
                    )}
                    <button onClick={() => { onStartDm(contact.userId); onClose(); }}
                      className="rounded-xl p-2 hover:bg-primary/10 text-primary" title="Message">
                      <MessageCircle className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Add contact / Find people dialog */}
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
              <input type="text" value={addSearch} onChange={(e) => setAddSearch(e.target.value)}
                placeholder="Search by name or username..." autoFocus
                className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none" />
            </div>
            <div className="max-h-60 overflow-y-auto space-y-1">
              {addResults.map((user) => {
                const alreadyFriend = mesh.isFriend(user.userId);
                const alreadySent = requestSent.has(user.userId);
                return (
                  <div key={user.userId} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-surface-hover transition-all">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-primary-glow/5 text-xs font-bold text-primary border border-primary/20">
                      {user.displayName.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2) || "??"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-medium text-foreground truncate">{user.displayName}</p>
                        {alreadyFriend && <UserCheck className="h-3 w-3 text-primary" />}
                      </div>
                      <p className="text-[10px] text-muted-foreground truncate">{user.userId}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      {alreadyFriend ? (
                        <span className="text-[10px] text-primary font-medium flex items-center gap-1"><Check className="h-3 w-3" /> Friend</span>
                      ) : (
                        <button onClick={() => { mesh.addFriend(user.userId); setRequestSent((s) => new Set(s).add(user.userId)); }}
                          disabled={alreadySent}
                          className={`rounded-xl px-2.5 py-1.5 text-[10px] font-medium transition-all ${
                            alreadySent ? "bg-secondary text-muted-foreground" : "gradient-primary text-primary-foreground shadow-glow"
                          }`}>
                          {alreadySent ? "Request sent" : "Add friend"}
                        </button>
                      )}
                      <button onClick={() => { onStartDm(user.userId); setShowAdd(false); onClose(); }}
                        className="rounded-xl p-1.5 hover:bg-primary/10 text-primary" title="Message">
                        <MessageCircle className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
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
