import { Sparkles, Shield, Globe, Lock, Server } from "lucide-react";

export function EmptyChat() {
  return (
    <div className="relative flex h-full flex-1 flex-col items-center justify-center bg-background px-8 overflow-hidden">
      {/* Animated background orbs */}
      <div className="pointer-events-none absolute top-1/4 left-1/4 h-96 w-96 rounded-full bg-primary/20 blur-3xl animate-float" />
      <div className="pointer-events-none absolute bottom-1/4 right-1/4 h-96 w-96 rounded-full bg-accent/20 blur-3xl animate-float" style={{ animationDelay: "2s" }} />
      <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-80 w-80 rounded-full bg-primary-glow/15 blur-3xl" />

      <div className="relative flex flex-col items-center gap-8 max-w-md text-center animate-fade-in-up">
        {/* Logo */}
        <div className="relative">
          <div className="absolute inset-0 gradient-primary blur-2xl opacity-60 animate-glow rounded-3xl" />
          <div className="relative flex h-24 w-24 items-center justify-center rounded-3xl gradient-primary shadow-elegant">
            <Sparkles className="h-12 w-12 text-primary-foreground" />
          </div>
          <div className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-online border-2 border-background shadow-lg shadow-online/50" />
        </div>

        {/* Title */}
        <div>
          <h1 className="font-serif italic text-5xl gradient-text mb-2 leading-none">
            Welcome to <span className="font-semibold">Meshlink</span>
          </h1>
          <p className="text-base text-muted-foreground max-w-sm mx-auto leading-relaxed">
            Self-hosted, end-to-end encrypted messenger. Your server, your data.
          </p>
        </div>

        {/* Feature grid */}
        <div className="grid grid-cols-2 gap-3 w-full">
          <FeatureCard icon={Server} label="Self-Hosted" sub="You own your data" />
          <FeatureCard icon={Globe} label="Federation" sub="Matrix protocol" />
          <FeatureCard icon={Lock} label="Encrypted" sub="End-to-end E2EE" />
          <FeatureCard icon={Shield} label="Private" sub="No tracking" />
        </div>

        {/* CTA hint */}
        <div className="flex flex-col items-center gap-2">
          <div className="flex items-center gap-2 px-4 py-2 rounded-full glass border border-border/50">
            <span className="h-1.5 w-1.5 rounded-full bg-online animate-pulse" />
            <p className="text-xs font-mono text-muted-foreground">
              Use the search bar to find users on this server
            </p>
          </div>
          <p className="text-[10px] text-muted-foreground/60">
            Type a name or username to start a conversation
          </p>
        </div>
      </div>
    </div>
  );
}

function FeatureCard({ icon: Icon, label, sub }: { icon: typeof Server; label: string; sub: string }) {
  return (
    <div className="group relative rounded-2xl glass border border-border/50 p-4 transition-all hover:border-primary/40 hover:shadow-glow hover:-translate-y-0.5 cursor-default">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-accent/10 mb-3 group-hover:scale-110 transition-transform">
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <p className="text-sm font-semibold text-foreground text-left">{label}</p>
      <p className="text-[11px] text-muted-foreground mt-0.5 text-left">{sub}</p>
    </div>
  );
}
