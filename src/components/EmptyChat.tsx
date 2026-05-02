import React from "react";
import { Sparkles, Shield, Globe, Lock, Server, MessageCircle, Users, Zap, Keyboard } from "lucide-react";

export function EmptyChat() {
  return (
    <div className="relative flex h-full flex-1 flex-col items-center justify-center bg-background px-8 overflow-hidden">
      {/* Animated background orbs */}
      <div className="pointer-events-none absolute top-1/4 left-1/4 h-96 w-96 rounded-full bg-primary/20 blur-3xl animate-float" />
      <div className="pointer-events-none absolute bottom-1/4 right-1/4 h-96 w-96 rounded-full bg-accent/20 blur-3xl animate-float" style={{ animationDelay: "2s" }} />
      <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-80 w-80 rounded-full bg-primary-glow/15 blur-3xl" />

      <div className="relative flex flex-col items-center gap-6 max-w-md text-center animate-fade-in-up">
        {/* Logo */}
        <div className="relative">
          <div className="absolute inset-0 gradient-primary blur-2xl opacity-60 animate-glow rounded-3xl" />
          <div className="relative flex h-20 w-20 md:h-24 md:w-24 items-center justify-center rounded-3xl gradient-primary shadow-elegant">
            <Sparkles className="h-10 w-10 md:h-12 md:w-12 text-primary-foreground" />
          </div>
          <div className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-online border-2 border-background shadow-lg shadow-online/50" />
        </div>

        {/* Title */}
        <div>
          <h1 className="font-serif italic text-3xl md:text-5xl gradient-text mb-2 leading-none">
            Welcome to <span className="font-semibold">Meshlink</span>
          </h1>
          <p className="text-sm md:text-base text-muted-foreground max-w-sm mx-auto leading-relaxed">
            Self-hosted, end-to-end encrypted messenger. Your server, your data.
          </p>
        </div>

        {/* Feature grid */}
        <div className="grid grid-cols-2 gap-2 md:gap-3 w-full">
          <FeatureCard icon={Server} label="Self-Hosted" sub="You own your data" />
          <FeatureCard icon={Globe} label="Federation" sub="Matrix protocol" />
          <FeatureCard icon={Lock} label="Encrypted" sub="End-to-end E2EE" />
          <FeatureCard icon={Shield} label="Private" sub="No tracking" />
        </div>

        {/* Quick tips */}
        <div className="w-full space-y-1.5">
          <QuickTip icon={<MessageCircle className="h-3.5 w-3.5" />} text="Search users in sidebar to start chatting" />
          <QuickTip icon={<Users className="h-3.5 w-3.5" />} text="Create groups and channels with the + button" />
          <QuickTip icon={<Zap className="h-3.5 w-3.5" />} text="Swipe messages to reply, double-tap to react ❤️" />
          <QuickTip icon={<Keyboard className="h-3.5 w-3.5" />} text="Press ? for keyboard shortcuts" />
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

function QuickTip({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl px-3 py-2 glass border border-border/30 text-left">
      <div className="text-primary flex-shrink-0">{icon}</div>
      <p className="text-[11px] text-muted-foreground">{text}</p>
    </div>
  );
}
