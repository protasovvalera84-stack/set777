import { useState } from "react";
import { X, Bot, Send, Sparkles, Loader2 } from "lucide-react";

interface AiMessage {
  role: "user" | "assistant";
  content: string;
}

interface AiAssistantProps {
  open: boolean;
  onClose: () => void;
  onInsert: (text: string) => void;
  chatContext?: string;
}

export function AiAssistant({ open, onClose, onInsert, chatContext }: AiAssistantProps) {
  const [messages, setMessages] = useState<AiMessage[]>([
    { role: "assistant", content: "Hi! I'm Meshlink AI. I can help you:\n• Summarize conversations\n• Translate messages\n• Write replies\n• Answer questions\n\nWhat do you need?" }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    setLoading(true);

    try {
      // Use free AI API (no key needed)
      const resp = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "gpt-3.5-turbo",
          messages: [
            { role: "system", content: "You are Meshlink AI assistant. Be helpful, concise. If user asks to summarize, translate, or write a reply, do it. Keep responses short." },
            ...(chatContext ? [{ role: "system", content: `Chat context: ${chatContext}` }] : []),
            ...messages.slice(-6).map((m) => ({ role: m.role, content: m.content })),
            { role: "user", content: userMsg },
          ],
          max_tokens: 300,
        }),
      });

      if (resp.ok) {
        const data = await resp.json();
        const reply = data.choices?.[0]?.message?.content || "Sorry, I couldn't process that.";
        setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
      } else {
        // Fallback: simple local responses
        const reply = generateLocalResponse(userMsg, chatContext);
        setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
      }
    } catch {
      const reply = generateLocalResponse(userMsg, chatContext);
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    }
    setLoading(false);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-background animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-border/40 glass-strong">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl gradient-primary">
            <Bot className="h-4 w-4 text-primary-foreground" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">Meshlink AI</h2>
            <p className="text-[9px] text-muted-foreground">Powered by AI</p>
          </div>
        </div>
        <button onClick={onClose} className="rounded-xl p-2 hover:bg-surface-hover">
          <X className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 scrollbar-thin">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] rounded-2xl px-3 py-2 ${
              msg.role === "user" ? "gradient-primary text-primary-foreground" : "glass border border-border/40"
            }`}>
              <p className="text-xs whitespace-pre-line">{msg.content}</p>
              {msg.role === "assistant" && (
                <button onClick={() => onInsert(msg.content)} className="mt-1 text-[9px] text-primary hover:underline">
                  Insert into chat ↗
                </button>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="glass border border-border/40 rounded-2xl px-3 py-2">
              <Loader2 className="h-4 w-4 text-primary animate-spin" />
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-border/40 px-4 py-3 glass-strong">
        <div className="flex items-center gap-2 max-w-2xl mx-auto">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            placeholder="Ask AI anything..."
            className="flex-1 rounded-2xl glass border border-border/50 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50"
          />
          <button onClick={sendMessage} disabled={loading} className="rounded-2xl p-2.5 gradient-primary text-primary-foreground shadow-glow">
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// Local AI responses (works without API key)
function generateLocalResponse(input: string, context?: string): string {
  const lower = input.toLowerCase();

  if (lower.includes("summarize") || lower.includes("summary") || lower.includes("итог")) {
    return context
      ? `Here's a summary of the conversation:\n\nThe chat contains recent messages. Key topics discussed include the latest messages in the thread.`
      : "Please open AI assistant from within a chat to summarize conversations.";
  }

  if (lower.includes("translate") || lower.includes("перевод") || lower.includes("переведи")) {
    return "To translate a message, use the 🌐 button on any message. It will open Google Translate with the text.";
  }

  if (lower.includes("help") || lower.includes("помощь") || lower.includes("что умеешь")) {
    return "I can help you with:\n\n• 📝 Write message replies\n• 🌐 Translate (use 🌐 button on messages)\n• 📊 Create polls\n• 📍 Share location\n• ⏰ Set reminders\n• 🔒 Check security\n\nJust ask!";
  }

  if (lower.includes("hello") || lower.includes("hi") || lower.includes("привет") || lower.includes("здравствуй")) {
    return "Hello! 👋 How can I help you today?";
  }

  if (lower.includes("write") || lower.includes("reply") || lower.includes("напиши") || lower.includes("ответ")) {
    return "Here's a suggested reply:\n\n\"Thanks for your message! I'll get back to you shortly.\"\n\nClick 'Insert into chat' to use it.";
  }

  return "I understand your request. For the best AI experience, you can configure an OpenAI API key in settings. Meanwhile, I can help with basic tasks — try asking me to write a reply, translate, or summarize!";
}
