import { useState } from "react";
import { X, Plus, BarChart3, Check, Trash2 } from "lucide-react";

interface PollOption {
  id: string;
  text: string;
  votes: number;
  votedByMe: boolean;
}

interface PollData {
  question: string;
  options: PollOption[];
  totalVotes: number;
  closed: boolean;
}

interface CreatePollDialogProps {
  open: boolean;
  onClose: () => void;
  onCreate: (question: string, options: string[]) => void;
}

export function CreatePollDialog({ open, onClose, onCreate }: CreatePollDialogProps) {
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);

  if (!open) return null;

  const addOption = () => {
    if (options.length < 10) setOptions([...options, ""]);
  };

  const removeOption = (idx: number) => {
    if (options.length > 2) setOptions(options.filter((_, i) => i !== idx));
  };

  const updateOption = (idx: number, value: string) => {
    setOptions(options.map((o, i) => i === idx ? value : o));
  };

  const handleCreate = () => {
    const validOptions = options.filter((o) => o.trim());
    if (!question.trim() || validOptions.length < 2) return;
    onCreate(question.trim(), validOptions);
    setQuestion("");
    setOptions(["", ""]);
    onClose();
  };

  const canCreate = question.trim() && options.filter((o) => o.trim()).length >= 2;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in-up" onClick={onClose}>
      <div className="absolute inset-0 bg-background/70 backdrop-blur-sm" />
      <div onClick={(e) => e.stopPropagation()} className="relative w-full max-w-sm rounded-3xl glass-strong border border-border/60 shadow-elegant p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-serif italic gradient-text">Create Poll</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-surface-hover">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        {/* Question */}
        <div className="mb-4">
          <label className="text-[10px] font-mono uppercase tracking-[0.15em] text-muted-foreground mb-1.5 block">Question</label>
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask a question..."
            autoFocus
            className="w-full rounded-2xl glass border border-border/50 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 bg-transparent"
          />
        </div>

        {/* Options */}
        <div className="mb-4 space-y-2">
          <label className="text-[10px] font-mono uppercase tracking-[0.15em] text-muted-foreground mb-1.5 block">Options</label>
          {options.map((opt, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="text"
                value={opt}
                onChange={(e) => updateOption(i, e.target.value)}
                placeholder={`Option ${i + 1}`}
                className="flex-1 rounded-xl glass border border-border/50 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 bg-transparent"
              />
              {options.length > 2 && (
                <button onClick={() => removeOption(i)} className="p-1 text-muted-foreground hover:text-destructive">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
          {options.length < 10 && (
            <button onClick={addOption} className="flex items-center gap-1.5 text-xs text-primary hover:underline">
              <Plus className="h-3 w-3" /> Add option
            </button>
          )}
        </div>

        <button
          onClick={handleCreate}
          disabled={!canCreate}
          className={`w-full rounded-2xl py-3 text-sm font-semibold transition-all ${
            canCreate ? "gradient-primary text-primary-foreground shadow-glow hover:scale-[1.02]" : "bg-secondary text-muted-foreground cursor-not-allowed"
          }`}
        >
          Create Poll
        </button>
      </div>
    </div>
  );
}

/* ===== Poll Display Component ===== */
interface PollDisplayProps {
  poll: PollData;
  onVote: (optionId: string) => void;
}

export function PollDisplay({ poll, onVote }: PollDisplayProps) {
  const hasVoted = poll.options.some((o) => o.votedByMe);

  return (
    <div className="mt-2 rounded-2xl glass border border-border/40 p-3">
      <div className="flex items-center gap-2 mb-2">
        <BarChart3 className="h-4 w-4 text-primary" />
        <p className="text-sm font-semibold text-foreground">{poll.question}</p>
      </div>

      <div className="space-y-1.5">
        {poll.options.map((opt) => {
          const percentage = poll.totalVotes > 0 ? Math.round((opt.votes / poll.totalVotes) * 100) : 0;
          return (
            <button
              key={opt.id}
              onClick={() => !hasVoted && !poll.closed && onVote(opt.id)}
              disabled={hasVoted || poll.closed}
              className={`relative w-full text-left rounded-xl px-3 py-2 text-xs transition-all overflow-hidden ${
                opt.votedByMe ? "border border-primary/40 bg-primary/10" : "border border-border/30 hover:border-primary/30"
              } ${hasVoted || poll.closed ? "cursor-default" : "cursor-pointer"}`}
            >
              {/* Progress bar background */}
              {hasVoted && (
                <div
                  className="absolute inset-0 bg-primary/10 rounded-xl transition-all"
                  style={{ width: `${percentage}%` }}
                />
              )}
              <div className="relative flex items-center justify-between">
                <span className="text-foreground flex items-center gap-1.5">
                  {opt.votedByMe && <Check className="h-3 w-3 text-primary" />}
                  {opt.text}
                </span>
                {hasVoted && (
                  <span className="text-[10px] font-mono text-muted-foreground">{percentage}%</span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <p className="mt-2 text-[10px] text-muted-foreground">
        {poll.totalVotes} vote{poll.totalVotes !== 1 ? "s" : ""}
        {poll.closed && " · Closed"}
      </p>
    </div>
  );
}
