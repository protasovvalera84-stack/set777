/** Skeleton loaders for chat list and messages */

export function ChatListSkeleton() {
  return (
    <div className="space-y-1 px-3 py-2 animate-pulse">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-2xl px-3 py-2.5" style={{ animationDelay: `${i * 50}ms` }}>
          <div className="h-10 w-10 rounded-2xl bg-secondary/80 flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-3.5 w-24 rounded-lg bg-secondary/80" />
            <div className="h-2.5 w-40 rounded-lg bg-secondary/50" />
          </div>
          <div className="h-2.5 w-8 rounded-lg bg-secondary/40" />
        </div>
      ))}
    </div>
  );
}

export function MessagesSkeleton() {
  return (
    <div className="space-y-4 px-4 py-6 animate-pulse">
      {[false, true, false, true, false, true, false].map((isOwn, i) => (
        <div key={i} className={`flex ${isOwn ? "justify-end" : "justify-start"}`} style={{ animationDelay: `${i * 80}ms` }}>
          <div className={`rounded-3xl px-4 py-3 ${isOwn ? "bg-primary/20" : "bg-secondary/60"}`} style={{ width: `${40 + Math.random() * 35}%` }}>
            <div className={`h-3 rounded-lg ${isOwn ? "bg-primary/30" : "bg-secondary/80"}`} style={{ width: `${60 + Math.random() * 40}%` }} />
            {Math.random() > 0.5 && (
              <div className={`h-3 mt-1.5 rounded-lg ${isOwn ? "bg-primary/20" : "bg-secondary/60"}`} style={{ width: `${30 + Math.random() * 50}%` }} />
            )}
            <div className={`h-2 mt-2 rounded-lg ${isOwn ? "bg-primary/10" : "bg-secondary/40"}`} style={{ width: "30%" }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function SidebarSkeleton() {
  return (
    <div className="flex h-full w-full md:w-80 flex-col bg-background border-r border-border/40">
      {/* Header skeleton */}
      <div className="px-4 py-4 animate-pulse">
        <div className="h-6 w-28 rounded-lg bg-secondary/80 mb-3" />
        <div className="h-10 w-full rounded-2xl bg-secondary/50" />
      </div>
      {/* Filter tabs skeleton */}
      <div className="flex gap-2 px-4 pb-3 animate-pulse">
        {[1,2,3,4].map((i) => (
          <div key={i} className="h-7 w-16 rounded-full bg-secondary/50" />
        ))}
      </div>
      {/* Chat list skeleton */}
      <ChatListSkeleton />
    </div>
  );
}
