import { useState, useMemo } from "react";
import { X, Search, Clock, Smile, Heart, Coffee, Flag, Car, Lightbulb, Music2 } from "lucide-react";

// Compact emoji dataset organized by category
const EMOJI_DATA: Record<string, string[]> = {
  recent: [],
  smileys: ["😀","😃","😄","😁","😆","😅","🤣","😂","🙂","😊","😇","🥰","😍","🤩","😘","😗","😚","😙","🥲","😋","😛","😜","🤪","😝","🤑","🤗","🤭","🤫","🤔","🫡","🤐","🤨","😐","😑","😶","🫥","😏","😒","🙄","😬","🤥","😌","😔","😪","🤤","😴","😷","🤒","🤕","🤢","🤮","🥵","🥶","🥴","😵","🤯","🤠","🥳","🥸","😎","🤓","🧐","😕","🫤","😟","🙁","😮","😯","😲","😳","🥺","🥹","😦","😧","😨","😰","😥","😢","😭","😱","😖","😣","😞","😓","😩","😫","🥱","😤","😡","😠","🤬","😈","👿","💀","☠️","💩","🤡","👹","👺","👻","👽","👾","🤖"],
  gestures: ["👋","🤚","🖐️","✋","🖖","🫱","🫲","🫳","🫴","👌","🤌","🤏","✌️","🤞","🫰","🤟","🤘","🤙","👈","👉","👆","🖕","👇","☝️","🫵","👍","👎","✊","👊","🤛","🤜","👏","🙌","🫶","👐","🤲","🤝","🙏","✍️","💅","🤳","💪","🦾","🦿","🦵","🦶","👂","🦻","👃","🧠","🫀","🫁","🦷","🦴","👀","👁️","👅","👄"],
  hearts: ["❤️","🧡","💛","💚","💙","💜","🖤","🤍","🤎","💔","❤️‍🔥","❤️‍🩹","❣️","💕","💞","💓","💗","💖","💘","💝","💟","♥️","💋","💌","💐","🌹","🥀","🌺","🌸","🌼","🌻","🌷","🪷","🪻","💮","🏵️"],
  food: ["🍏","🍎","🍐","🍊","🍋","🍌","🍉","🍇","🍓","🫐","🍈","🍒","🍑","🥭","🍍","🥥","🥝","🍅","🍆","🥑","🥦","🥬","🥒","🌶️","🫑","🌽","🥕","🫒","🧄","🧅","🥔","🍠","🫘","🥐","🥖","🍞","🥨","🥯","🧀","🥚","🍳","🧈","🥞","🧇","🥓","🥩","🍗","🍖","🦴","🌭","🍔","🍟","🍕","🫓","🥪","🥙","🧆","🌮","🌯","🫔","🥗","🥘","🫕","🥫","🍝","🍜","🍲","🍛","🍣","🍱","🥟","🦪","🍤","🍙","🍚","🍘","🍥","🥠","🥮","🍢","🍡","🍧","🍨","🍦","🥧","🧁","🍰","🎂","🍮","🍭","🍬","🍫","🍿","🍩","🍪","🌰","🥜","🍯","🥛","🍼","🫖","☕","🍵","🧃","🥤","🧋","🍶","🍺","🍻","🥂","🍷","🥃","🍸","🍹","🧉","🍾","🧊","🥄","🍴","🍽️","🥣","🥡","🥢","🧂"],
  travel: ["🚗","🚕","🚙","🚌","🚎","🏎️","🚓","🚑","🚒","🚐","🛻","🚚","🚛","🚜","🏍️","🛵","🚲","🛴","🛹","🛼","🚏","🛣️","🛤️","🛞","⛽","🛞","🚨","🚥","🚦","🛑","🚧","⚓","🛟","⛵","🛶","🚤","🛳️","⛴️","🛥️","🚢","✈️","🛩️","🛫","🛬","🪂","💺","🚁","🚟","🚠","🚡","🛰️","🚀","🛸"],
  objects: ["⌚","📱","📲","💻","⌨️","🖥️","🖨️","🖱️","🖲️","🕹️","🗜️","💽","💾","💿","📀","📼","📷","📸","📹","🎥","📽️","🎞️","📞","☎️","📟","📠","📺","📻","🎙️","🎚️","🎛️","🧭","⏱️","⏲️","⏰","🕰️","⌛","⏳","📡","🔋","🪫","🔌","💡","🔦","🕯️","🪔","🧯","🛢️","💸","💵","💴","💶","💷","🪙","💰","💳","💎","⚖️","🪜","🧰","🪛","🔧","🔨","⚒️","🛠️","⛏️","🪚","🔩","⚙️","🪤","🧱","⛓️","🧲","🔫","💣","🧨","🪓","🔪","🗡️","⚔️","🛡️","🚬","⚰️","🪦","⚱️","🏺","🔮","📿","🧿","🪬","💈","⚗️","🔭","🔬","🕳️","🩻","🩹","🩺","💊","💉","🩸","🧬","🦠","🧫","🧪","🌡️","🧹","🪠","🧺","🧻","🚽","🚰","🚿","🛁","🛀","🧼","🪥","🪒","🧽","🪣","🧴","🛎️","🔑","🗝️","🚪","🪑","🛋️","🛏️","🛌","🧸","🪆","🖼️","🪞","🪟","🛍️","🛒","🎁","🎈","🎏","🎀","🪄","🪅","🎊","🎉","🎎","🏮","🎐","🧧","✉️","📩","📨","📧","💌","📥","📤","📦","🏷️","🪧","📪","📫","📬","📭","📮","📯","📜","📃","📄","📑","🧾","📊","📈","📉","🗒️","🗓️","📆","📅","🗑️","📇","🗃️","🗳️","🗄️","📋","📁","📂","🗂️","🗞️","📰","📓","📔","📒","📕","📗","📘","📙","📚","📖","🔖","🧷","🔗","📎","🖇️","📐","📏","🧮","📌","📍","✂️","🖊️","🖋️","✒️","🖌️","🖍️","📝","✏️","🔍","🔎","🔏","🔐","🔒","🔓"],
  flags: ["🏁","🚩","🎌","🏴","🏳️","🏳️‍🌈","🏳️‍⚧️","🏴‍☠️","🇷🇺","🇺🇸","🇬🇧","🇩🇪","🇫🇷","🇪🇸","🇮🇹","🇯🇵","🇰🇷","🇨🇳","🇧🇷","🇮🇳","🇦🇺","🇨🇦","🇲🇽","🇦🇷","🇹🇷","🇸🇦","🇦🇪","🇮🇱","🇺🇦","🇰🇿","🇧🇾","🇬🇪","🇦🇿"],
};

const CATEGORIES = [
  { id: "recent", icon: Clock, label: "Recent" },
  { id: "smileys", icon: Smile, label: "Smileys" },
  { id: "gestures", icon: Smile, label: "Gestures" },
  { id: "hearts", icon: Heart, label: "Hearts" },
  { id: "food", icon: Coffee, label: "Food" },
  { id: "travel", icon: Car, label: "Travel" },
  { id: "objects", icon: Lightbulb, label: "Objects" },
  { id: "flags", icon: Flag, label: "Flags" },
];

interface EmojiPickerProps {
  open: boolean;
  onClose: () => void;
  onSelect: (emoji: string) => void;
}

export function EmojiPicker({ open, onClose, onSelect }: EmojiPickerProps) {
  const [category, setCategory] = useState("smileys");
  const [search, setSearch] = useState("");

  // Load recent emojis from localStorage
  const recentEmojis = useMemo(() => {
    try {
      const saved = localStorage.getItem("meshlink-recent-emojis");
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  }, []);

  const handleSelect = (emoji: string) => {
    onSelect(emoji);
    // Save to recent
    try {
      const recent = JSON.parse(localStorage.getItem("meshlink-recent-emojis") || "[]");
      const updated = [emoji, ...recent.filter((e: string) => e !== emoji)].slice(0, 30);
      localStorage.setItem("meshlink-recent-emojis", JSON.stringify(updated));
    } catch { /* ignore */ }
  };

  const filteredEmojis = useMemo(() => {
    if (search) {
      // Search across all categories
      return Object.values(EMOJI_DATA).flat().filter((e) =>
        e.includes(search)
      ).slice(0, 60);
    }
    if (category === "recent") return recentEmojis;
    return EMOJI_DATA[category] || [];
  }, [category, search, recentEmojis]);

  if (!open) return null;

  return (
    <div className="absolute bottom-full left-0 right-0 mb-2 z-40 mx-4 md:mx-6 animate-fade-in-up">
      <div className="rounded-2xl glass-strong border border-border/60 shadow-elegant overflow-hidden max-w-md mx-auto">
        {/* Header */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border/30">
          <Search className="h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search emoji..."
            className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground outline-none"
            autoFocus
          />
          <button onClick={onClose} className="p-1 hover:bg-surface-hover rounded-lg">
            <X className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </div>

        {/* Categories */}
        <div className="flex gap-0.5 px-2 py-1.5 border-b border-border/20 overflow-x-auto">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => { setCategory(cat.id); setSearch(""); }}
              className={`p-1.5 rounded-lg transition-all ${
                category === cat.id ? "bg-primary/20 text-primary" : "text-muted-foreground hover:bg-surface-hover"
              }`}
              title={cat.label}
            >
              <cat.icon className="h-3.5 w-3.5" />
            </button>
          ))}
        </div>

        {/* Emoji grid */}
        <div className="grid grid-cols-8 gap-0.5 p-2 max-h-48 overflow-y-auto scrollbar-thin">
          {filteredEmojis.map((emoji, i) => (
            <button
              key={`${emoji}-${i}`}
              onClick={() => handleSelect(emoji)}
              className="flex items-center justify-center h-8 w-8 rounded-lg hover:bg-surface-hover transition-all text-lg hover:scale-110"
            >
              {emoji}
            </button>
          ))}
          {filteredEmojis.length === 0 && (
            <p className="col-span-8 text-center text-xs text-muted-foreground py-4">No emojis found</p>
          )}
        </div>
      </div>
    </div>
  );
}
