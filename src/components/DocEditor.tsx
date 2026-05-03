import { useState, useRef } from "react";
import { X, Save, Bold, Italic, Code, List, Heading, Download } from "lucide-react";

interface DocEditorProps {
  open: boolean;
  onClose: () => void;
  chatId: string;
}

export function DocEditor({ open, onClose, chatId }: DocEditorProps) {
  const [title, setTitle] = useState(() => localStorage.getItem(`meshlink-doc-title-${chatId}`) || "Untitled Document");
  const [content, setContent] = useState(() => localStorage.getItem(`meshlink-doc-${chatId}`) || "");
  const [saved, setSaved] = useState(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  if (!open) return null;

  const handleChange = (value: string) => {
    setContent(value);
    setSaved(false);
  };

  const save = () => {
    localStorage.setItem(`meshlink-doc-${chatId}`, content);
    localStorage.setItem(`meshlink-doc-title-${chatId}`, title);
    setSaved(true);
  };

  const insertMarkdown = (before: string, after: string = "") => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = content.slice(start, end);
    const newContent = content.slice(0, start) + before + selected + after + content.slice(end);
    handleChange(newContent);
  };

  const exportDoc = () => {
    const blob = new Blob([`# ${title}\n\n${content}`], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${title}.md`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-[55] flex flex-col bg-background animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border/40 glass-strong">
        <div className="flex items-center gap-2 flex-1">
          <input
            type="text"
            value={title}
            onChange={(e) => { setTitle(e.target.value); setSaved(false); }}
            className="text-sm font-semibold text-foreground bg-transparent outline-none flex-1"
          />
          <span className={`text-[9px] ${saved ? "text-online" : "text-yellow-500"}`}>
            {saved ? "Saved" : "Unsaved"}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={save} className="rounded-lg p-1.5 hover:bg-surface-hover" title="Save">
            <Save className="h-4 w-4 text-primary" />
          </button>
          <button onClick={exportDoc} className="rounded-lg p-1.5 hover:bg-surface-hover" title="Export">
            <Download className="h-4 w-4 text-muted-foreground" />
          </button>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-surface-hover">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-1 px-4 py-1.5 border-b border-border/20">
        <button onClick={() => insertMarkdown("**", "**")} className="rounded-lg p-1.5 hover:bg-surface-hover" title="Bold">
          <Bold className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
        <button onClick={() => insertMarkdown("*", "*")} className="rounded-lg p-1.5 hover:bg-surface-hover" title="Italic">
          <Italic className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
        <button onClick={() => insertMarkdown("`", "`")} className="rounded-lg p-1.5 hover:bg-surface-hover" title="Code">
          <Code className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
        <button onClick={() => insertMarkdown("# ")} className="rounded-lg p-1.5 hover:bg-surface-hover" title="Heading">
          <Heading className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
        <button onClick={() => insertMarkdown("- ")} className="rounded-lg p-1.5 hover:bg-surface-hover" title="List">
          <List className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
        <div className="w-px h-4 bg-border/40 mx-1" />
        <span className="text-[9px] text-muted-foreground font-mono">{content.length} chars</span>
      </div>

      {/* Editor */}
      <textarea
        ref={textareaRef}
        value={content}
        onChange={(e) => handleChange(e.target.value)}
        placeholder="Start writing..."
        className="flex-1 px-4 py-4 text-sm text-foreground bg-transparent outline-none resize-none font-mono leading-relaxed scrollbar-thin"
        onKeyDown={(e) => {
          if ((e.ctrlKey || e.metaKey) && e.key === "s") { e.preventDefault(); save(); }
        }}
      />
    </div>
  );
}
