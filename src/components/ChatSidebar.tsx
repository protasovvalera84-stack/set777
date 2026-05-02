import { useState, useEffect, useRef, lazy, Suspense } from "react";
import { Search, Plus, Hash, Users, Pin, Sparkles, Star, FolderPlus, Folder, X, Pencil, Check, UserPlus, MessageCircle, Zap, Briefcase, CalendarDays, Wallet, Globe, Lock as LockIcon, ChevronDown } from "lucide-react";
import { Chat, Story, StoryItem, UserProfile, ChatFolder } from "@/data/mockData";
import { CreateChatDialog } from "@/components/CreateChatDialog";
import { ShortsBar, type Short, type ShortItem } from "@/components/ShortsBar";
import { useMesh } from "@/lib/MeshProvider";

// Lazy load heavy dialog pages
const ContactsPage = lazy(() => import("@/components/ContactsPage").then(m => ({ default: m.ContactsPage })));
const SchedulerPage = lazy(() => import("@/components/SchedulerPage").then(m => ({ default: m.SchedulerPage })));
const AutoReplyPage = lazy(() => import("@/components/AutoReplyPage").then(m => ({ default: m.AutoReplyPage })));
const WalletPage = lazy(() => import("@/components/WalletPage").then(m => ({ default: m.WalletPage })));

export interface SearchResult {
  type: "user" | "room";
  id: string;
  name: string;
  avatar: string;
  members?: number;
}

interface ChatSidebarProps {
  chats: Chat[];
  stories: Story[];
  profile: UserProfile;
  folders: ChatFolder[];
  selectedChatId: string | null;
  onSelectChat: (id: string) => void;
  onCreateChat: (chat: Chat) => void;
  onAddStory: (items: StoryItem[]) => void;
  onOpenSettings: () => void;
  onFoldersChange: (folders: ChatFolder[]) => void;
  onSearch?: (query: string) => Promise<SearchResult[]>;
  onStartDm?: (userId: string) => void;
  onJoinRoom?: (roomId: string) => void;
}

type FilterType = "all" | "dm" | "group" | "channel" | "favorites";

const TypeIcon = ({ type }: { type: Chat["type"] }) => {
  if (type === "channel") return <Hash className="h-3 w-3 text-accent" />;
  if (type === "group") return <Users className="h-3 w-3 text-primary" />;
  return null;
};

export function ChatSidebar({ chats, stories, profile, folders, selectedChatId, onSelectChat, onCreateChat, onAddStory, onOpenSettings, onFoldersChange, onSearch, onStartDm, onJoinRoom }: ChatSidebarProps) {
  const mesh = useMesh();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [createType, setCreateType] = useState<"group" | "channel">("group");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [logoMenuOpen, setLogoMenuOpen] = useState(false);
  const [mutedChats, setMutedChats] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem("meshlink-muted");
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch { return new Set(); }
  });
  const [archivedChats, setArchivedChats] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem("meshlink-archived");
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch { return new Set(); }
  });
  const [showArchived, setShowArchived] = useState(false);
  const [contactsOpen, setContactsOpen] = useState(false);
  const [schedulerOpen, setSchedulerOpen] = useState(false);
  const [autoReplyOpen, setAutoReplyOpen] = useState(false);
  const [walletOpen, setWalletOpen] = useState(false);
  const [sortBy, setSortBy] = useState<"recent" | "unread" | "name">("recent");
  const logoMenuRef = useRef<HTMLDivElement>(null);

  // Shorts state (persisted in localStorage)
  const [shorts, setShorts] = useState<Short[]>(() => {
    try {
      const saved = localStorage.getItem("meshlink-shorts");
      if (saved) return JSON.parse(saved);
    } catch { /* ignore */ }
    return [];
  });

  // Persist shorts
  useEffect(() => {
    localStorage.setItem("meshlink-shorts", JSON.stringify(shorts));
  }, [shorts]);

  const handleAddShort = (items: ShortItem[]) => {
    setShorts((prev) => {
      const existing = prev.find((s) => s.userId === "me");
      if (existing) {
        return prev.map((s) => s.userId === "me" ? { ...s, items: [...s.items, ...items] } : s);
      }
      return [{ id: `short-${Date.now()}`, userId: "me", userName: profile.name, avatar: profile.avatarInitials, items, viewed: true }, ...prev];
    });
  };

  const handleDeleteShort = (shortId: string, itemId: string) => {
    setShorts((prev) => prev.map((s) => {
      if (s.id !== shortId) return s;
      const filtered = s.items.filter((i) => i.id !== itemId);
      return filtered.length > 0 ? { ...s, items: filtered } : s;
    }).filter((s) => s.items.length > 0));
  };

  const toggleMute = (chatId: string) => {
    setMutedChats((prev) => {
      const next = new Set(prev);
      if (next.has(chatId)) next.delete(chatId); else next.add(chatId);
      localStorage.setItem("meshlink-muted", JSON.stringify([...next]));
      return next;
    });
  };

  const toggleArchive = (chatId: string) => {
    setArchivedChats((prev) => {
      const next = new Set(prev);
      if (next.has(chatId)) next.delete(chatId); else next.add(chatId);
      localStorage.setItem("meshlink-archived", JSON.stringify([...next]));
      return next;
    });
  };

  // Close logo menu on click outside
  useEffect(() => {
    if (!logoMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (logoMenuRef.current && !logoMenuRef.current.contains(e.target as Node)) {
        setLogoMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [logoMenuOpen]);

  // Folders UI state (data comes from props)
  const [activeFolder, setActiveFolder] = useState<string | null>(null);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [editingFolder, setEditingFolder] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [addingToFolder, setAddingToFolder] = useState<string | null>(null); // folderId being added to

  // Server-side search with debounce
  useEffect(() => {
    if (!search.trim() || !onSearch) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const results = await onSearch(search.trim());
        setSearchResults(results);
      } catch {
        setSearchResults([]);
      }
      setSearching(false);
    }, 400);
    return () => clearTimeout(timer);
  }, [search, onSearch]);

  const filtered = chats.filter((c) => {
    // Hide archived chats unless showing archived
    if (!showArchived && archivedChats.has(c.id)) return false;
    if (showArchived) return archivedChats.has(c.id);
    if (search && !c.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (filter === "favorites") {
      if (activeFolder) {
        const folder = folders.find((f) => f.id === activeFolder);
        return folder ? folder.chatIds.includes(c.id) : false;
      }
      // Show all favorited chats across all folders
      const allFavIds = new Set(folders.flatMap((f) => f.chatIds));
      return allFavIds.has(c.id);
    }
    if (filter !== "all" && c.type !== filter) return false;
    return true;
  });

  const pinned = filtered.filter((c) => c.pinned);
  const unpinned = filtered.filter((c) => !c.pinned);

  const openCreateDialog = (type: "group" | "channel") => {
    setCreateType(type);
    setCreateOpen(true);
  };

  const createFolder = () => {
    if (!newFolderName.trim()) return;
    onFoldersChange([...folders, { id: `folder-${Date.now()}`, name: newFolderName.trim(), chatIds: [] }]);
    setNewFolderName("");
    setCreatingFolder(false);
  };

  const renameFolder = (id: string) => {
    if (!editName.trim()) return;
    onFoldersChange(folders.map((f) => f.id === id ? { ...f, name: editName.trim() } : f));
    setEditingFolder(null);
    setEditName("");
  };

  const deleteFolder = (id: string) => {
    onFoldersChange(folders.filter((f) => f.id !== id));
    if (activeFolder === id) setActiveFolder(null);
  };

  const toggleChatInFolder = (folderId: string, chatId: string) => {
    onFoldersChange(folders.map((f) => {
      if (f.id !== folderId) return f;
      const has = f.chatIds.includes(chatId);
      return { ...f, chatIds: has ? f.chatIds.filter((id) => id !== chatId) : [...f.chatIds, chatId] };
    }));
  };

  const allFavIds = new Set(folders.flatMap((f) => f.chatIds));

  return (
    <>
      <div className="relative flex h-full w-full md:w-80 flex-col border-r border-border/40 glass-strong">
        <div className="pointer-events-none absolute -top-20 -left-20 h-60 w-60 rounded-full bg-primary/20 blur-3xl" />

        {/* Header with logo menu */}
        <div className="relative flex items-center justify-between px-5 py-4 border-b border-border/40" ref={logoMenuRef}>
          <button
            onClick={() => setLogoMenuOpen((v) => !v)}
            className="flex items-center gap-2.5 hover:opacity-80 transition-opacity"
          >
            <div className="relative">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl gradient-primary shadow-glow">
                <Sparkles className="h-4 w-4 text-primary-foreground" />
              </div>
            </div>
            <div className="flex flex-col leading-tight">
              <span className="font-serif italic text-lg gradient-text font-semibold">Meshlink</span>
              <span className="font-mono text-[9px] tracking-[0.2em] uppercase text-muted-foreground">self-hosted</span>
            </div>
            <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${logoMenuOpen ? "rotate-180" : ""}`} />
          </button>

          {/* Dropdown menu */}
          {logoMenuOpen && (
            <div className="absolute top-full left-3 right-3 mt-1 z-50 rounded-2xl glass-strong border border-border/60 shadow-elegant p-2 animate-fade-in-up">
              <LogoMenuItem icon={<Zap className="h-4 w-4 text-amber-400" />} label="Ультимейт" sub="v2.0" />
              <LogoMenuItem icon={<Briefcase className="h-4 w-4 text-blue-400" />} label="Для бизнеса" sub="v2.0" />
              <LogoMenuItem icon={<CalendarDays className="h-4 w-4 text-green-400" />} label="Планировщик" sub="" onClick={() => { setLogoMenuOpen(false); setSchedulerOpen(true); }} />
              <LogoMenuItem icon={<Wallet className="h-4 w-4 text-purple-400" />} label="Мой Кошелек" sub="" onClick={() => { setLogoMenuOpen(false); setWalletOpen(true); }} />
              <LogoMenuItem icon={<Globe className="h-4 w-4 text-cyan-400" />} label="Экосистема Meshlink" sub="v2.0" />
            </div>
          )}
        </div>

        {/* Shorts */}
        <ShortsBar
          shorts={shorts}
          myUserId="me"
          myName={profile.name}
          myAvatar={profile.avatarInitials}
          myAvatarUrl={profile.avatarUrl}
          onAddShort={handleAddShort}
          onDeleteShort={handleDeleteShort}
        />

        {/* Search */}
        <div className="relative px-4 py-3">
          <div className="group flex items-center gap-2.5 rounded-2xl glass border border-border/50 px-4 py-2.5 transition-all focus-within:border-primary/50 focus-within:shadow-glow">
            <Search className="h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
            <input type="text" placeholder="Search the mesh..." value={search} onChange={(e) => setSearch(e.target.value)} className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none" />
          </div>
        </div>

        {/* Filters */}
        <div className="relative flex gap-1.5 px-4 pb-3 overflow-x-auto scrollbar-thin">
          {(["all", "dm", "group", "channel", "favorites"] as const).map((f) => (
            <button
              key={f}
              onClick={() => { setFilter(f); if (f !== "favorites") setActiveFolder(null); }}
              className={`relative rounded-full px-3 py-1.5 text-[11px] font-medium transition-all flex-shrink-0 ${
                filter === f ? "gradient-primary text-primary-foreground shadow-glow" : "text-muted-foreground hover:text-foreground hover:bg-surface-hover"
              }`}
            >
              {f === "dm" ? "Direct" : f === "all" ? "All" : f === "favorites" ? (
                <span className="flex items-center gap-1"><Star className="h-3 w-3" /> Favorites</span>
              ) : f.charAt(0).toUpperCase() + f.slice(1) + "s"}
            </button>
          ))}
        </div>

        {/* Create button for Groups / Channels */}
        {(filter === "group" || filter === "channel") && (
          <div className="px-4 pb-2">
            <button onClick={() => openCreateDialog(filter)} className="flex w-full items-center gap-2.5 rounded-2xl border border-dashed border-primary/40 px-3 py-2.5 text-sm font-medium text-primary hover:bg-primary/5 hover:border-primary/60 transition-all">
              <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${filter === "channel" ? "bg-gradient-to-br from-accent/20 to-accent/5 border border-accent/20" : "bg-gradient-to-br from-primary/20 to-primary-glow/5 border border-primary/20"}`}>
                <Plus className={`h-4 w-4 ${filter === "channel" ? "text-accent" : "text-primary"}`} />
              </div>
              <span>Create {filter === "channel" ? "Channel" : "Group"}</span>
            </button>
          </div>
        )}

        {/* Favorites: Folder management */}
        {filter === "favorites" && (
          <div className="px-4 pb-2 space-y-1.5">
            {/* Folder tabs */}
            <div className="flex gap-1.5 overflow-x-auto scrollbar-thin pb-1">
              <button
                onClick={() => setActiveFolder(null)}
                className={`flex-shrink-0 rounded-xl px-2.5 py-1.5 text-[11px] font-medium transition-all ${
                  activeFolder === null ? "bg-primary/15 text-primary border border-primary/30" : "text-muted-foreground hover:bg-surface-hover"
                }`}
              >
                All
              </button>
              {folders.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setActiveFolder(f.id)}
                  className={`flex-shrink-0 flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-[11px] font-medium transition-all ${
                    activeFolder === f.id ? "bg-primary/15 text-primary border border-primary/30" : "text-muted-foreground hover:bg-surface-hover"
                  }`}
                >
                  <Folder className="h-3 w-3" />
                  {f.name}
                  <span className="text-[9px] opacity-60">{f.chatIds.length}</span>
                </button>
              ))}
              <button onClick={() => setCreatingFolder(true)} className="flex-shrink-0 rounded-xl px-2 py-1.5 text-muted-foreground hover:text-primary hover:bg-surface-hover transition-all">
                <FolderPlus className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Create folder inline */}
            {creatingFolder && (
              <div className="flex items-center gap-2">
                <input type="text" value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} placeholder="Folder name" autoFocus
                  onKeyDown={(e) => e.key === "Enter" && createFolder()}
                  className="flex-1 rounded-xl glass border border-border/50 px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 bg-transparent" />
                <button onClick={createFolder} disabled={!newFolderName.trim()} className="rounded-lg p-1.5 text-primary hover:bg-primary/10"><Check className="h-3.5 w-3.5" /></button>
                <button onClick={() => { setCreatingFolder(false); setNewFolderName(""); }} className="rounded-lg p-1.5 text-muted-foreground hover:bg-surface-hover"><X className="h-3.5 w-3.5" /></button>
              </div>
            )}

            {/* Folder settings when a folder is active */}
            {activeFolder && (
              <div className="flex items-center gap-1.5">
                {editingFolder === activeFolder ? (
                  <div className="flex items-center gap-1.5 flex-1">
                    <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} autoFocus
                      onKeyDown={(e) => e.key === "Enter" && renameFolder(activeFolder)}
                      className="flex-1 rounded-lg glass border border-border/50 px-2 py-1 text-xs text-foreground outline-none focus:border-primary/50 bg-transparent" />
                    <button onClick={() => renameFolder(activeFolder)} className="text-primary"><Check className="h-3.5 w-3.5" /></button>
                    <button onClick={() => setEditingFolder(null)} className="text-muted-foreground"><X className="h-3.5 w-3.5" /></button>
                  </div>
                ) : (
                  <>
                    <button onClick={() => { setEditingFolder(activeFolder); setEditName(folders.find((f) => f.id === activeFolder)?.name || ""); }}
                      className="text-[10px] text-muted-foreground hover:text-primary flex items-center gap-1"><Pencil className="h-3 w-3" /> Rename</button>
                    <span className="text-border">|</span>
                    <button onClick={() => setAddingToFolder(addingToFolder === activeFolder ? null : activeFolder)}
                      className="text-[10px] text-muted-foreground hover:text-primary flex items-center gap-1"><Plus className="h-3 w-3" /> Add chats</button>
                    <span className="text-border">|</span>
                    <button onClick={() => deleteFolder(activeFolder)} className="text-[10px] text-destructive hover:underline">Delete</button>
                  </>
                )}
              </div>
            )}

            {/* Add chats to folder picker */}
            {addingToFolder && (
              <div className="max-h-40 overflow-y-auto scrollbar-thin space-y-0.5 rounded-xl glass border border-border/50 p-2">
                {chats.map((c) => {
                  const inFolder = folders.find((f) => f.id === addingToFolder)?.chatIds.includes(c.id);
                  return (
                    <button key={c.id} onClick={() => toggleChatInFolder(addingToFolder, c.id)}
                      className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[11px] transition-all ${inFolder ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-surface-hover"}`}>
                      <TypeIcon type={c.type} />
                      <span className="flex-1 truncate">{c.name}</span>
                      {inFolder && <Check className="h-3 w-3" />}
                    </button>
                  );
                })}
                <button onClick={() => setAddingToFolder(null)} className="w-full text-center text-[10px] text-muted-foreground hover:text-foreground mt-1">Done</button>
              </div>
            )}
          </div>
        )}

        {/* Chat list */}
        <div className="relative flex-1 overflow-y-auto scrollbar-thin">
          {/* Search results from server */}
          {search.trim() && searchResults.length > 0 && (
            <div className="px-3 py-2">
              <div className="flex items-center gap-1.5 px-2 py-2">
                <Search className="h-3 w-3 text-primary" />
                <span className="text-[10px] font-mono font-semibold uppercase tracking-[0.15em] gradient-text">Found on server</span>
                <div className="flex-1 h-px bg-gradient-to-r from-border/60 to-transparent ml-2" />
              </div>
              {searchResults.map((r) => (
                <button
                  key={r.id}
                  onClick={() => {
                    if (r.type === "user" && onStartDm) onStartDm(r.id);
                    else if (r.type === "room" && onJoinRoom) onJoinRoom(r.id);
                    setSearch("");
                  }}
                  className="group flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-all hover:bg-surface-hover border border-transparent"
                >
                  <div className={`flex h-11 w-11 items-center justify-center rounded-2xl text-xs font-bold transition-transform group-hover:scale-105 ${
                    r.type === "user"
                      ? "bg-gradient-to-br from-primary/30 to-primary-glow/10 text-primary border border-primary/20"
                      : "bg-gradient-to-br from-accent/30 to-accent/10 text-accent border border-accent/20"
                  }`}>
                    {r.avatar}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-semibold text-foreground truncate block">{r.name}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {r.type === "user" ? "User" : `${r.members || 0} members`}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {r.type === "user" ? (
                      <UserPlus className="h-4 w-4 text-primary" />
                    ) : (
                      <MessageCircle className="h-4 w-4 text-accent" />
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
          {search.trim() && searching && (
            <div className="px-5 py-4 text-center">
              <p className="text-xs text-muted-foreground animate-pulse">Searching...</p>
            </div>
          )}
          {search.trim() && !searching && searchResults.length === 0 && (
            <div className="px-5 py-4 text-center">
              <Search className="h-6 w-6 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">No users or rooms found for "{search}"</p>
              <p className="text-[10px] text-muted-foreground/60 mt-1">Try searching by username or display name</p>
            </div>
          )}

          {pinned.length > 0 && (
            <div className="px-3 py-1">
              <div className="flex items-center gap-1.5 px-2 py-2">
                <Pin className="h-3 w-3 text-primary" />
                <span className="text-[10px] font-mono font-semibold uppercase tracking-[0.15em] gradient-text">Pinned</span>
                <div className="flex-1 h-px bg-gradient-to-r from-border/60 to-transparent ml-2" />
              </div>
              {pinned.map((chat, i) => (
                <ChatItem key={chat.id} chat={chat} selected={chat.id === selectedChatId} onSelect={onSelectChat} index={i} isFavorite={allFavIds.has(chat.id)} isMuted={mutedChats.has(chat.id)} onMute={() => toggleMute(chat.id)} typingNames={mesh.typingUsers[chat.id]} />
              ))}
            </div>
          )}

          <div className="px-3 py-1">
            {pinned.length > 0 && (
              <div className="flex items-center gap-1.5 px-2 py-2 mt-2">
                <span className="text-[10px] font-mono font-semibold uppercase tracking-[0.15em] text-muted-foreground">Recent</span>
                <div className="flex-1 h-px bg-gradient-to-r from-border/60 to-transparent ml-2" />
              </div>
            )}
            {unpinned.length === 0 && filter !== "all" && (
              <div className="flex flex-col items-center py-8 text-center">
                {filter === "favorites" ? (
                  <>
                    <Star className="h-8 w-8 text-muted-foreground/30 mb-3" />
                    <p className="text-sm text-muted-foreground">No favorites yet</p>
                    <p className="text-[11px] text-muted-foreground/60 mt-1">Add chats to folders from the folder menu</p>
                  </>
                ) : (
                  <>
                    <div className={`flex h-12 w-12 items-center justify-center rounded-2xl mb-3 ${
                      filter === "channel" ? "bg-gradient-to-br from-accent/20 to-accent/5 border border-accent/20" :
                      filter === "group" ? "bg-gradient-to-br from-primary/20 to-primary-glow/5 border border-primary/20" : "bg-secondary border border-border"
                    }`}>
                      {filter === "channel" ? <Hash className="h-5 w-5 text-accent" /> : filter === "group" ? <Users className="h-5 w-5 text-primary" /> : null}
                    </div>
                    <p className="text-sm text-muted-foreground">No {filter === "channel" ? "channels" : filter === "group" ? "groups" : "chats"} yet</p>
                    {(filter === "group" || filter === "channel") && (
                      <button onClick={() => openCreateDialog(filter)} className="mt-2 text-xs font-medium text-primary hover:underline">
                        Create your first {filter === "channel" ? "channel" : "group"}
                      </button>
                    )}
                  </>
                )}
              </div>
            )}
            {unpinned.map((chat, i) => (
              <ChatItem key={chat.id} chat={chat} selected={chat.id === selectedChatId} onSelect={onSelectChat} index={i} isFavorite={allFavIds.has(chat.id)} isMuted={mutedChats.has(chat.id)} onMute={() => toggleMute(chat.id)} typingNames={mesh.typingUsers[chat.id]} />
            ))}
          </div>
        </div>

        {/* Quick access toolbar */}
        <div className="border-t border-border/40 px-2 py-1 glass">
          <div className="flex items-center justify-around">
            <button onClick={() => setAutoReplyOpen(true)} className="p-2 rounded-xl hover:bg-surface-hover" title="Auto-Reply">
              <span className="text-base">🤖</span>
            </button>
            <button onClick={() => setWalletOpen(true)} className="p-2 rounded-xl hover:bg-surface-hover" title="Wallet">
              <span className="text-base">👛</span>
            </button>
            <button onClick={() => setSchedulerOpen(true)} className="p-2 rounded-xl hover:bg-surface-hover" title="Scheduler">
              <span className="text-base">📅</span>
            </button>
            <button onClick={() => setContactsOpen(true)} className="p-2 rounded-xl hover:bg-surface-hover" title="Contacts">
              <span className="text-base">👥</span>
            </button>
          </div>
        </div>

        {/* Footer — compact */}
        <button onClick={onOpenSettings} className="relative border-t border-border/40 px-3 py-2 glass w-full text-left hover:bg-surface-hover transition-all">
          <div className="flex items-center gap-2">
            <div className="relative">
              {profile.avatarUrl ? (
                <img src={profile.avatarUrl} alt="" className="h-8 w-8 rounded-xl object-cover border border-primary/30" />
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded-xl gradient-primary text-[10px] font-bold text-primary-foreground">{profile.avatarInitials}</div>
              )}
              {profile.privacy.onlineStatus && <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card bg-online shadow-lg shadow-online/50" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">{profile.name}</p>
              <p className="text-[10px] font-mono text-muted-foreground truncate">{profile.peerId}</p>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-[9px] font-mono text-online">● ONLINE</span>
              <span className="text-[9px] font-mono text-muted-foreground">encrypted</span>
            </div>
          </div>
        </button>
      </div>

      <CreateChatDialog open={createOpen} type={createType} onClose={() => setCreateOpen(false)} onCreate={onCreateChat} />
      <Suspense fallback={null}>
        {contactsOpen && <ContactsPage open={contactsOpen} onClose={() => setContactsOpen(false)} onStartDm={onStartDm} />}
        {schedulerOpen && <SchedulerPage open={schedulerOpen} onClose={() => setSchedulerOpen(false)} />}
        {autoReplyOpen && <AutoReplyPage open={autoReplyOpen} onClose={() => setAutoReplyOpen(false)} />}
        {walletOpen && <WalletPage open={walletOpen} onClose={() => setWalletOpen(false)} />}
      </Suspense>
    </>
  );
}

function ChatItem({ chat, selected, onSelect, index, isFavorite, isMuted, onMute, typingNames }: { chat: Chat; selected: boolean; onSelect: (id: string) => void; index: number; isFavorite?: boolean; isMuted?: boolean; onMute?: () => void; typingNames?: string[] }) {
  return (
    <button
      onClick={() => onSelect(chat.id)}
      onContextMenu={(e) => { e.preventDefault(); onMute?.(); }}
      style={{ animationDelay: `${index * 30}ms` }}
      className={`group relative flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-all animate-fade-in-up ${
        selected ? "bg-gradient-to-r from-primary/20 via-primary/10 to-transparent border border-primary/30 shadow-glow" : "hover:bg-surface-hover border border-transparent"
      }`}
    >
      {selected && <div className="absolute left-0 top-1/2 -translate-y-1/2 h-8 w-1 rounded-r-full gradient-primary" />}

      <div className="relative flex-shrink-0">
        {chat.avatarUrl ? (
          <img src={chat.avatarUrl} alt="" className="h-11 w-11 rounded-2xl object-cover border border-border/40 transition-transform group-hover:scale-105" />
        ) : (
          <div className={`flex h-11 w-11 items-center justify-center rounded-2xl text-xs font-bold transition-transform group-hover:scale-105 ${
            chat.type === "channel" ? "bg-gradient-to-br from-accent/30 to-accent/10 text-accent border border-accent/20" :
            chat.type === "group" ? "bg-gradient-to-br from-primary/30 to-primary-glow/10 text-primary border border-primary/20" :
            "bg-gradient-to-br from-secondary to-muted text-foreground border border-border"
          }`}>
            {chat.avatar}
          </div>
        )}
        {chat.online && <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card bg-online shadow-lg shadow-online/40" />}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 min-w-0">
            <TypeIcon type={chat.type} />
            <span className="text-sm font-semibold text-foreground truncate">{chat.name}</span>
            {isFavorite && <Star className="h-2.5 w-2.5 text-primary/50 flex-shrink-0" />}
          </div>
          <span className="text-[10px] font-mono text-muted-foreground flex-shrink-0">{chat.lastMessageTime}</span>
        </div>
        <div className="flex items-center justify-between mt-0.5">
          <p className="text-xs text-muted-foreground truncate pr-2">
            {typingNames && typingNames.length > 0 ? (
              <span className="text-primary animate-pulse italic">{typingNames[0]} typing...</span>
            ) : chat.lastMessage}
          </p>
          {chat.unread > 0 && !isMuted && (
            <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full gradient-primary px-1.5 text-[10px] font-bold text-primary-foreground flex-shrink-0 shadow-glow">{chat.unread}</span>
          )}
          {isMuted && (
            <span className="text-[9px] text-muted-foreground/50">🔇</span>
          )}
        </div>
      </div>
    </button>
  );
}

function LogoMenuItem({ icon, label, sub, onClick }: { icon: React.ReactNode; label: string; sub: string; onClick?: () => void }) {
  return (
    <button
      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all hover:bg-surface-hover ${!onClick ? "opacity-60 cursor-default" : ""}`}
      disabled={!onClick}
      onClick={onClick}
    >
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary/80">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">{label}</p>
      </div>
      {sub && <span className="text-[9px] font-mono text-muted-foreground bg-secondary/80 px-1.5 py-0.5 rounded-md">{sub}</span>}
    </button>
  );
}
