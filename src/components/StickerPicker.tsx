import { useState } from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

// Built-in sticker packs (emoji-based stickers rendered as large images)
const STICKER_PACKS = [
  {
    id: "emotions",
    name: "Emotions",
    icon: "😊",
    stickers: [
      "😀", "😂", "🥰", "😎", "🤩", "😇", "🥳", "😤", "😭", "🤯",
      "😱", "🤗", "😈", "💀", "🤡", "👻", "🙈", "🙉", "🙊", "💩",
      "❤️‍🔥", "💔", "💯", "🔥", "⭐", "🌈", "🦋", "🌸", "🍀", "🎉",
    ],
  },
  {
    id: "animals",
    name: "Animals",
    icon: "🐱",
    stickers: [
      "🐶", "🐱", "🐭", "🐹", "🐰", "🦊", "🐻", "🐼", "🐨", "🐯",
      "🦁", "🐮", "🐷", "🐸", "🐵", "🐔", "🐧", "🐦", "🦅", "🦆",
      "🦉", "🐺", "🐗", "🐴", "🦄", "🐝", "🐛", "🦋", "🐌", "🐙",
    ],
  },
  {
    id: "food",
    name: "Food",
    icon: "🍕",
    stickers: [
      "🍕", "🍔", "🍟", "🌭", "🍿", "🧀", "🥐", "🍩", "🍪", "🎂",
      "🍰", "🧁", "🍫", "🍬", "🍭", "🍮", "🍯", "🥤", "🧋", "☕",
      "🍺", "🍷", "🥂", "🍾", "🧃", "🥛", "🍵", "🫖", "🍹", "🧉",
    ],
  },
  {
    id: "activities",
    name: "Activities",
    icon: "⚽",
    stickers: [
      "⚽", "🏀", "🏈", "⚾", "🎾", "🏐", "🏉", "🎱", "🏓", "🏸",
      "🥊", "🎯", "🎮", "🕹️", "🎲", "🧩", "🎭", "🎨", "🎬", "🎤",
      "🎧", "🎼", "🎹", "🥁", "🎷", "🎺", "🎸", "🪕", "🎻", "🎪",
    ],
  },
  {
    id: "gestures",
    name: "Gestures",
    icon: "👍",
    stickers: [
      "👍", "👎", "👊", "✊", "🤛", "🤜", "👏", "🙌", "🤝", "🙏",
      "✌️", "🤞", "🤟", "🤘", "👌", "🤌", "👈", "👉", "👆", "👇",
      "☝️", "✋", "🤚", "🖐️", "🖖", "👋", "🤙", "💪", "🦾", "🖕",
    ],
  },
];

interface StickerPickerProps {
  open: boolean;
  onClose: () => void;
  onSelect: (sticker: string) => void;
}

export function StickerPicker({ open, onClose, onSelect }: StickerPickerProps) {
  const [packIndex, setPackIndex] = useState(0);

  if (!open) return null;

  const currentPack = STICKER_PACKS[packIndex];

  return (
    <div className="absolute bottom-full left-0 right-0 mb-2 z-40 mx-4 md:mx-6 animate-fade-in-up">
      <div className="rounded-2xl glass-strong border border-border/60 shadow-elegant overflow-hidden max-w-md mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-border/30">
          <div className="flex items-center gap-2">
            <span className="text-sm">{currentPack.icon}</span>
            <span className="text-xs font-medium text-foreground">{currentPack.name}</span>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-surface-hover rounded-lg">
            <X className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </div>

        {/* Pack tabs */}
        <div className="flex items-center gap-1 px-2 py-1.5 border-b border-border/20 overflow-x-auto">
          {STICKER_PACKS.map((pack, i) => (
            <button
              key={pack.id}
              onClick={() => setPackIndex(i)}
              className={`flex-shrink-0 p-1.5 rounded-lg text-base transition-all ${
                i === packIndex ? "bg-primary/20 scale-110" : "hover:bg-surface-hover"
              }`}
              title={pack.name}
            >
              {pack.icon}
            </button>
          ))}
        </div>

        {/* Sticker grid */}
        <div className="grid grid-cols-6 gap-1 p-2 max-h-52 overflow-y-auto scrollbar-thin">
          {currentPack.stickers.map((sticker, i) => (
            <button
              key={`${sticker}-${i}`}
              onClick={() => onSelect(sticker)}
              className="flex items-center justify-center h-12 w-12 rounded-xl hover:bg-surface-hover transition-all text-2xl hover:scale-125"
            >
              {sticker}
            </button>
          ))}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between px-3 py-1.5 border-t border-border/20">
          <button
            onClick={() => setPackIndex((i) => Math.max(0, i - 1))}
            disabled={packIndex === 0}
            className="p-1 rounded-lg hover:bg-surface-hover disabled:opacity-30"
          >
            <ChevronLeft className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
          <span className="text-[9px] text-muted-foreground">{packIndex + 1} / {STICKER_PACKS.length}</span>
          <button
            onClick={() => setPackIndex((i) => Math.min(STICKER_PACKS.length - 1, i + 1))}
            disabled={packIndex === STICKER_PACKS.length - 1}
            className="p-1 rounded-lg hover:bg-surface-hover disabled:opacity-30"
          >
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </div>
      </div>
    </div>
  );
}
