/**
 * Meshlink Marketplace — Buy/Sell/Trade classifieds
 *
 * Like VK Market, Facebook Marketplace, OLX.
 * Listings stored in public Matrix room.
 */

import { useState, useRef, useEffect } from "react";
import { X, Plus, Search, MapPin, Tag, DollarSign, Heart, MessageCircle, Upload, Filter, Image } from "lucide-react";
import { useMesh } from "@/lib/MeshProvider";
import { uploadMedia, mxcToUrl } from "@/lib/meshClient";

interface Listing {
  id: string;
  title: string;
  description: string;
  price: string;
  currency: string;
  category: string;
  location: string;
  imageUrl?: string;
  author: string;
  authorId: string;
  timestamp: string;
  liked?: boolean;
}

interface MarketplaceProps {
  open: boolean;
  onClose: () => void;
  onStartDm?: (userId: string) => void;
}

const CATEGORIES = ["All", "Electronics", "Clothing", "Home", "Auto", "Services", "Jobs", "Other"];
const ROOM_ALIAS = "meshlink-market";

export function MarketplacePage({ open, onClose, onStartDm }: MarketplaceProps) {
  const mesh = useMesh();
  const [listings, setListings] = useState<Listing[]>([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !mesh.client) return;
    setLoading(true);
    loadListings().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mesh.client]);

  const getRoomId = async (): Promise<string | null> => {
    if (!mesh.client) return null;
    const baseUrl = mesh.client.getHomeserverUrl();
    const token = mesh.client.getAccessToken();
    const serverName = mesh.userId?.split(":")[1] || "";
    const fullAlias = `#${ROOM_ALIAS}:${serverName}`;
    try {
      const resp = await fetch(`${baseUrl}/_matrix/client/v3/directory/room/${encodeURIComponent(fullAlias)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (resp.ok) {
        const data = await resp.json() as any;
        const joinResp = await fetch(`${baseUrl}/_matrix/client/v3/join/${encodeURIComponent(fullAlias)}`, {
          method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: "{}",
        });
        if (joinResp.ok) return data.room_id;
      }
      const createResp = await fetch(`${baseUrl}/_matrix/client/v3/createRoom`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: "Meshlink Marketplace", preset: "public_chat", room_alias_name: ROOM_ALIAS,
          initial_state: [
            { type: "m.room.join_rules", content: { join_rule: "public" }, state_key: "" },
            { type: "m.room.history_visibility", content: { history_visibility: "world_readable" }, state_key: "" },
          ],
        }),
      });
      if (createResp.ok) {
        const newRoom = ((await createResp.json()) as any).room_id;
        await fetch(`${baseUrl}/_matrix/client/v3/rooms/${encodeURIComponent(newRoom)}/state/m.room.power_levels/`, {
          method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ events_default: 0, state_default: 50, users_default: 0 }),
        }).catch(() => {});
        return newRoom;
      }
    } catch { /* ignore */ }
    return null;
  };

  const loadListings = async () => {
    const roomId = await getRoomId();
    if (!roomId || !mesh.client) return;
    const baseUrl = mesh.client.getHomeserverUrl();
    const token = mesh.client.getAccessToken();
    try {
      const resp = await fetch(`${baseUrl}/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/messages?dir=b&limit=100`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) return;
      const data = await resp.json() as any;
      const items: Listing[] = [];
      for (const evt of (data.chunk || [])) {
        if (evt.type === "org.meshlink.listing") {
          const c = evt.content;
          items.push({
            id: evt.event_id,
            title: c.title || "Untitled",
            description: c.description || "",
            price: c.price || "0",
            currency: c.currency || "$",
            category: c.category || "Other",
            location: c.location || "",
            imageUrl: c.imageUrl,
            author: c.author || evt.sender?.split(":")[0].replace("@", "") || "User",
            authorId: evt.sender || "",
            timestamp: new Date(evt.origin_server_ts).toLocaleDateString(),
          });
        }
      }
      setListings(items);
    } catch { /* ignore */ }
  };

  const handleCreate = async (title: string, description: string, price: string, cat: string, location: string, imageFile?: File) => {
    if (!mesh.client) return;
    const baseUrl = mesh.client.getHomeserverUrl();
    const token = mesh.client.getAccessToken() || "";
    const roomId = await getRoomId();
    if (!roomId) return;

    let imageUrl: string | undefined;
    if (imageFile) {
      const mxcUri = await uploadMedia(token, imageFile);
      imageUrl = mxcToUrl(mxcUri);
    }

    const userName = mesh.userId?.split(":")[0].replace("@", "") || "User";
    const txn = `lst${Date.now()}`;
    await fetch(`${baseUrl}/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/send/org.meshlink.listing/${txn}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ title, description, price, currency: "$", category: cat, location, imageUrl, author: userName }),
    });

    await loadListings();
    setShowCreate(false);
  };

  if (!open) return null;

  const filtered = listings.filter((l) => {
    if (category !== "All" && l.category !== category) return false;
    if (search && !l.title.toLowerCase().includes(search.toLowerCase()) && !l.description.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="fixed inset-0 z-[55] flex flex-col bg-background animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border/40">
        <div className="flex items-center gap-2">
          <Tag className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-serif italic gradient-text">Marketplace</h2>
          <span className="text-[10px] text-muted-foreground">{listings.length} listings</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowCreate(true)} className="rounded-xl p-2 hover:bg-surface-hover" title="Create listing">
            <Plus className="h-4 w-4 text-primary" />
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
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search marketplace..." className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none" />
        </div>
      </div>

      {/* Categories */}
      <div className="flex gap-1.5 px-4 pb-3 overflow-x-auto scrollbar-thin">
        {CATEGORIES.map((cat) => (
          <button key={cat} onClick={() => setCategory(cat)}
            className={`flex-shrink-0 rounded-full px-3 py-1.5 text-[11px] font-medium transition-all ${
              category === cat ? "gradient-primary text-primary-foreground shadow-glow" : "text-muted-foreground hover:bg-surface-hover"
            }`}>{cat}</button>
        ))}
      </div>

      {/* Listings */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <Tag className="h-12 w-12 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">{search ? "No listings found" : "No listings yet"}</p>
            <button onClick={() => setShowCreate(true)} className="text-xs text-primary hover:underline">Create first listing</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {filtered.map((listing) => (
              <div key={listing.id} className="rounded-2xl border border-border/40 overflow-hidden hover:border-primary/30 transition-all">
                {listing.imageUrl ? (
                  <img src={listing.imageUrl} alt="" className="w-full h-40 object-cover" />
                ) : (
                  <div className="w-full h-40 bg-secondary flex items-center justify-center">
                    <Image className="h-8 w-8 text-muted-foreground/30" />
                  </div>
                )}
                <div className="p-3">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-base font-bold text-primary">{listing.currency}{listing.price}</p>
                    <span className="text-[9px] text-muted-foreground bg-secondary rounded-full px-2 py-0.5">{listing.category}</span>
                  </div>
                  <p className="text-sm font-medium text-foreground line-clamp-1">{listing.title}</p>
                  <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">{listing.description}</p>
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/30">
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      {listing.location && <><MapPin className="h-3 w-3" /><span>{listing.location}</span></>}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] text-muted-foreground">{listing.author} · {listing.timestamp}</span>
                      {onStartDm && listing.authorId !== mesh.userId && (
                        <button onClick={() => { onStartDm(listing.authorId); onClose(); }}
                          className="rounded-lg p-1 hover:bg-primary/10 text-primary" title="Message seller">
                          <MessageCircle className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create listing dialog */}
      {showCreate && <CreateListingDialog onClose={() => setShowCreate(false)} onSubmit={handleCreate} />}
    </div>
  );
}

function CreateListingDialog({ onClose, onSubmit }: { onClose: () => void; onSubmit: (title: string, desc: string, price: string, cat: string, loc: string, img?: File) => Promise<void> }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [cat, setCat] = useState("Other");
  const [location, setLocation] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-background/70 backdrop-blur-sm" />
      <div onClick={(e) => e.stopPropagation()} className="relative w-full max-w-md rounded-3xl glass-strong border border-border/60 shadow-elegant p-6 max-h-[90vh] overflow-y-auto">
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => {
          const f = e.target.files?.[0]; if (!f) return;
          setImageFile(f); setImagePreview(URL.createObjectURL(f));
        }} />

        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-serif italic gradient-text">New Listing</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-surface-hover"><X className="h-4 w-4 text-muted-foreground" /></button>
        </div>

        {/* Image */}
        {imagePreview ? (
          <div className="mb-4 relative">
            <img src={imagePreview} alt="" className="w-full h-40 object-cover rounded-2xl" />
            <button onClick={() => { setImageFile(null); setImagePreview(""); }} className="absolute top-2 right-2 p-1 rounded-full bg-black/60"><X className="h-3 w-3 text-white" /></button>
          </div>
        ) : (
          <button onClick={() => fileRef.current?.click()} className="w-full mb-4 flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border/50 py-6 hover:border-primary/40 transition-all">
            <Upload className="h-6 w-6 text-muted-foreground" /><span className="text-xs text-muted-foreground">Add photo</span>
          </button>
        )}

        <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title..."
          className="w-full mb-3 rounded-2xl glass border border-border/50 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 bg-transparent" />

        <div className="flex gap-2 mb-3">
          <div className="flex items-center gap-1 rounded-2xl glass border border-border/50 px-3 py-3 flex-1">
            <DollarSign className="h-4 w-4 text-muted-foreground" />
            <input type="text" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Price"
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none" />
          </div>
          <select value={cat} onChange={(e) => setCat(e.target.value)}
            className="rounded-2xl glass border border-border/50 px-3 py-3 text-sm text-foreground bg-transparent outline-none">
            {CATEGORIES.filter((c) => c !== "All").map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div className="flex items-center gap-1 rounded-2xl glass border border-border/50 px-3 py-3 mb-3">
          <MapPin className="h-4 w-4 text-muted-foreground" />
          <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Location"
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none" />
        </div>

        <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description..." rows={3}
          className="w-full mb-4 rounded-2xl glass border border-border/50 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 bg-transparent resize-none" />

        <button onClick={async () => { if (!title.trim() || !price.trim()) return; setSubmitting(true); try { await onSubmit(title, description, price, cat, location, imageFile || undefined); } finally { setSubmitting(false); } }}
          disabled={!title.trim() || !price.trim() || submitting}
          className={`w-full rounded-2xl py-3 text-sm font-semibold transition-all ${title.trim() && price.trim() && !submitting ? "gradient-primary text-primary-foreground shadow-glow" : "bg-secondary text-muted-foreground cursor-not-allowed"}`}>
          {submitting ? "Publishing..." : "Publish Listing"}
        </button>
      </div>
    </div>
  );
}
