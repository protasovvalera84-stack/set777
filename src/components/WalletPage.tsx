import { useState } from "react";
import { X, Send, ArrowDownLeft, ArrowUpRight, Copy, RefreshCw, Shield } from "lucide-react";

interface Transaction {
  id: string;
  type: "sent" | "received";
  amount: string;
  currency: string;
  to: string;
  date: string;
}

interface WalletPageProps {
  open: boolean;
  onClose: () => void;
}

export function WalletPage({ open, onClose }: WalletPageProps) {
  const [balance, setBalance] = useState(() => {
    return parseFloat(localStorage.getItem("meshlink-wallet-balance") || "100");
  });
  const [showSend, setShowSend] = useState(false);
  const [showReceive, setShowReceive] = useState(false);
  const [sendTo, setSendTo] = useState("");
  const [sendAmount, setSendAmount] = useState("");
  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    try { return JSON.parse(localStorage.getItem("meshlink-wallet-tx") || "[]"); } catch { return []; }
  });

  const walletAddress = `mesh_${Math.random().toString(36).slice(2, 10)}...${Math.random().toString(36).slice(2, 6)}`;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[55] flex flex-col bg-background animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border/40">
        <div>
          <h2 className="text-lg font-serif italic gradient-text">Wallet</h2>
          <p className="text-[11px] text-muted-foreground">Meshlink P2P Transfers</p>
        </div>
        <button onClick={onClose} className="rounded-xl p-2 hover:bg-surface-hover">
          <X className="h-5 w-5 text-muted-foreground" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
        {/* Balance card */}
        <div className="rounded-3xl bg-gradient-to-br from-primary/20 via-primary/10 to-accent/5 border border-primary/30 p-6 text-center">
          <p className="text-[9px] font-mono uppercase tracking-[0.15em] text-muted-foreground mb-1">Total Balance</p>
          <p className="text-3xl font-bold gradient-text">{balance.toFixed(2)} MLK</p>
          <p className="text-xs text-muted-foreground mt-1">Meshlink Tokens</p>

          {/* Actions */}
          <div className="flex items-center justify-center gap-4 mt-5">
            <button
              onClick={() => setShowSend(true)}
              className="flex flex-col items-center gap-1"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl gradient-primary shadow-glow">
                <ArrowUpRight className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="text-[10px] text-muted-foreground">Send</span>
            </button>
            <button onClick={() => setShowReceive(true)} className="flex flex-col items-center gap-1">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary border border-border/40">
                <ArrowDownLeft className="h-5 w-5 text-foreground" />
              </div>
              <span className="text-[10px] text-muted-foreground">Receive</span>
            </button>
            <button onClick={() => navigator.clipboard?.writeText(walletAddress)} className="flex flex-col items-center gap-1">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary border border-border/40">
                <RefreshCw className="h-5 w-5 text-foreground" />
              </div>
              <span className="text-[10px] text-muted-foreground">Swap</span>
            </button>
          </div>
        </div>

        {/* Wallet address */}
        <div className="rounded-2xl glass border border-border/40 p-4">
          <p className="text-[9px] font-mono uppercase tracking-[0.15em] text-muted-foreground mb-2">Your Wallet Address</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs text-foreground bg-secondary/50 rounded-xl px-3 py-2 truncate font-mono">
              {walletAddress}
            </code>
            <button
              onClick={() => navigator.clipboard?.writeText(walletAddress)}
              className="p-2 rounded-xl hover:bg-surface-hover"
            >
              <Copy className="h-4 w-4 text-primary" />
            </button>
          </div>
          <div className="flex items-center gap-1.5 mt-2">
            <Shield className="h-3 w-3 text-primary" />
            <p className="text-[9px] text-muted-foreground">End-to-end encrypted · Decentralized</p>
          </div>
        </div>

        {/* Transactions */}
        <div className="rounded-2xl glass border border-border/40 p-4">
          <p className="text-[9px] font-mono uppercase tracking-[0.15em] text-muted-foreground mb-3">Recent Transactions</p>
          {transactions.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-xs text-muted-foreground">No transactions yet</p>
              <p className="text-[10px] text-muted-foreground/60 mt-1">Send or receive MLK tokens to get started</p>
            </div>
          ) : (
            <div className="space-y-2">
              {transactions.map((tx) => (
                <div key={tx.id} className="flex items-center gap-3 rounded-xl px-3 py-2">
                  <div className={`flex h-8 w-8 items-center justify-center rounded-full ${tx.type === "received" ? "bg-online/20" : "bg-primary/20"}`}>
                    {tx.type === "received" ? <ArrowDownLeft className="h-4 w-4 text-online" /> : <ArrowUpRight className="h-4 w-4 text-primary" />}
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-foreground">{tx.type === "received" ? "Received from" : "Sent to"} {tx.to}</p>
                    <p className="text-[10px] text-muted-foreground">{tx.date}</p>
                  </div>
                  <p className={`text-sm font-mono font-bold ${tx.type === "received" ? "text-online" : "text-foreground"}`}>
                    {tx.type === "received" ? "+" : "-"}{tx.amount} {tx.currency}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="rounded-2xl bg-primary/5 border border-primary/10 p-4">
          <p className="text-[11px] text-muted-foreground">
            <strong className="text-foreground">Meshlink Wallet</strong> — P2P transfers between Meshlink users.
            Send tokens directly in chats. All transactions are encrypted and decentralized via Matrix protocol.
          </p>
        </div>
      </div>

      {/* Send dialog */}
      {showSend && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" onClick={() => setShowSend(false)}>
          <div className="absolute inset-0 bg-background/70 backdrop-blur-sm" />
          <div onClick={(e) => e.stopPropagation()} className="relative w-full max-w-sm rounded-3xl glass-strong border border-border/60 shadow-elegant p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-serif italic gradient-text">Send MLK</h3>
              <button onClick={() => setShowSend(false)} className="rounded-lg p-1.5 hover:bg-surface-hover">
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-mono uppercase text-muted-foreground mb-1 block">Recipient</label>
                <input
                  type="text"
                  value={sendTo}
                  onChange={(e) => setSendTo(e.target.value)}
                  placeholder="@username or wallet address"
                  className="w-full rounded-2xl glass border border-border/50 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 bg-transparent"
                />
              </div>
              <div>
                <label className="text-[10px] font-mono uppercase text-muted-foreground mb-1 block">Amount</label>
                <div className="flex items-center gap-2 rounded-2xl glass border border-border/50 px-4 py-3 focus-within:border-primary/50">
                  <input
                    type="number"
                    value={sendAmount}
                    onChange={(e) => setSendAmount(e.target.value)}
                    placeholder="0.00"
                    className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
                  />
                  <span className="text-xs font-mono text-muted-foreground">MLK</span>
                </div>
              </div>
              <button
                onClick={() => {
                  const amount = parseFloat(sendAmount);
                  if (!sendTo.trim() || isNaN(amount) || amount <= 0 || amount > balance) return;
                  const tx: Transaction = { id: `tx-${Date.now()}`, type: "sent", amount: amount.toFixed(2), currency: "MLK", to: sendTo.trim(), date: new Date().toLocaleString() };
                  const newTx = [tx, ...transactions];
                  const newBalance = balance - amount;
                  setTransactions(newTx);
                  setBalance(newBalance);
                  localStorage.setItem("meshlink-wallet-tx", JSON.stringify(newTx));
                  localStorage.setItem("meshlink-wallet-balance", String(newBalance));
                  setSendTo(""); setSendAmount(""); setShowSend(false);
                }}
                disabled={!sendTo.trim() || !sendAmount || parseFloat(sendAmount) > balance}
                className={`w-full rounded-2xl py-3 text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
                  sendTo.trim() && sendAmount && parseFloat(sendAmount) <= balance ? "gradient-primary text-primary-foreground shadow-glow hover:scale-[1.02]" : "bg-secondary text-muted-foreground cursor-not-allowed"
                }`}
              >
                <Send className="h-4 w-4" /> Send Tokens
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Receive dialog */}
      {showReceive && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" onClick={() => setShowReceive(false)}>
          <div className="absolute inset-0 bg-background/70 backdrop-blur-sm" />
          <div onClick={(e) => e.stopPropagation()} className="relative w-full max-w-sm rounded-3xl glass-strong border border-border/60 shadow-elegant p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-serif italic gradient-text">Receive MLK</h3>
              <button onClick={() => setShowReceive(false)} className="rounded-lg p-1.5 hover:bg-surface-hover">
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground mb-3">Share your wallet address to receive tokens:</p>
            <div className="flex items-center gap-2 mb-4">
              <code className="flex-1 text-xs text-foreground bg-secondary/50 rounded-xl px-3 py-2.5 truncate font-mono">{walletAddress}</code>
              <button onClick={() => navigator.clipboard?.writeText(walletAddress)} className="p-2 rounded-xl hover:bg-surface-hover">
                <Copy className="h-4 w-4 text-primary" />
              </button>
            </div>
            <div className="rounded-2xl bg-white p-4 flex items-center justify-center">
              <div className="grid grid-cols-7 gap-0.5">
                {Array.from({ length: 49 }).map((_, i) => (
                  <div key={i} className={`w-3 h-3 rounded-sm ${Math.random() > 0.5 ? "bg-black" : "bg-white"}`} />
                ))}
              </div>
            </div>
            <p className="text-[9px] text-muted-foreground text-center mt-2">Scan QR code to send tokens</p>
          </div>
        </div>
      )}
    </div>
  );
}
