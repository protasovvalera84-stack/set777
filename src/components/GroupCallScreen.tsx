import { useState } from "react";
import { X, Phone, PhoneOff, Mic, MicOff, Video, VideoOff, Users, Monitor } from "lucide-react";

interface Participant {
  id: string;
  name: string;
  avatar: string;
  isMuted: boolean;
  isVideoOn: boolean;
  isSpeaking: boolean;
}

interface GroupCallScreenProps {
  open: boolean;
  chatName: string;
  participants: string[];
  onEnd: () => void;
}

export function GroupCallScreen({ open, chatName, participants, onEnd }: GroupCallScreenProps) {
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);

  if (!open) return null;

  // Simulate participants from member IDs
  const members: Participant[] = [
    { id: "me", name: "You", avatar: "ME", isMuted, isVideoOn, isSpeaking: false },
    ...participants.slice(0, 8).map((p, i) => ({
      id: p,
      name: p.split(":")[0].replace("@", "") || `User ${i + 1}`,
      avatar: (p.split(":")[0].replace("@", "")[0] || "U").toUpperCase(),
      isMuted: Math.random() > 0.5,
      isVideoOn: Math.random() > 0.7,
      isSpeaking: Math.random() > 0.8,
    })),
  ];

  // Grid layout based on participant count
  const gridCols = members.length <= 2 ? "grid-cols-1 md:grid-cols-2" :
    members.length <= 4 ? "grid-cols-2" :
    members.length <= 6 ? "grid-cols-2 md:grid-cols-3" :
    "grid-cols-3 md:grid-cols-4";

  return (
    <div className="fixed inset-0 z-[70] bg-black flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/80">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-white/70" />
          <div>
            <p className="text-sm font-medium text-white">{chatName}</p>
            <p className="text-[10px] text-white/50">{members.length} participants</p>
          </div>
        </div>
        <button onClick={onEnd} className="rounded-lg p-2 hover:bg-white/10">
          <X className="h-5 w-5 text-white" />
        </button>
      </div>

      {/* Participant grid */}
      <div className={`flex-1 grid ${gridCols} gap-1 p-2 overflow-hidden`}>
        {members.map((p) => (
          <div
            key={p.id}
            className={`relative rounded-2xl overflow-hidden flex items-center justify-center ${
              p.isVideoOn ? "bg-gradient-to-br from-primary/30 to-accent/20" : "bg-white/5"
            } ${p.isSpeaking ? "ring-2 ring-primary" : ""}`}
          >
            {p.isVideoOn ? (
              <div className="w-full h-full bg-gradient-to-br from-primary/20 to-accent/10 flex items-center justify-center">
                <Video className="h-8 w-8 text-white/30" />
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-primary/40 to-accent/20 text-xl font-bold text-white border border-white/20">
                  {p.avatar}
                </div>
              </div>
            )}

            {/* Name + status overlay */}
            <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
              <div className="flex items-center gap-1.5 bg-black/60 rounded-lg px-2 py-1">
                <span className="text-[10px] text-white font-medium truncate">{p.name}</span>
                {p.isMuted && <MicOff className="h-3 w-3 text-destructive" />}
              </div>
              {p.isSpeaking && (
                <div className="flex gap-0.5">
                  {[1,2,3].map((bar) => (
                    <div key={bar} className="w-0.5 bg-primary rounded-full animate-pulse" style={{ height: `${8 + bar * 4}px`, animationDelay: `${bar * 100}ms` }} />
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-4 px-4 py-4 bg-black/80">
        <button
          onClick={() => setIsMuted((m) => !m)}
          className={`flex h-12 w-12 items-center justify-center rounded-full transition-all ${isMuted ? "bg-destructive/20 text-destructive" : "bg-white/10 text-white hover:bg-white/20"}`}
        >
          {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
        </button>
        <button
          onClick={() => setIsVideoOn((v) => !v)}
          className={`flex h-12 w-12 items-center justify-center rounded-full transition-all ${!isVideoOn ? "bg-white/10 text-white hover:bg-white/20" : "bg-primary/20 text-primary"}`}
        >
          {isVideoOn ? <VideoOff className="h-5 w-5" /> : <Video className="h-5 w-5" />}
        </button>
        <button
          onClick={onEnd}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive text-white shadow-lg hover:scale-105 transition-all"
        >
          <PhoneOff className="h-6 w-6" />
        </button>
        <button
          onClick={() => setIsScreenSharing((s) => !s)}
          className={`flex h-12 w-12 items-center justify-center rounded-full transition-all ${isScreenSharing ? "bg-primary/20 text-primary" : "bg-white/10 text-white hover:bg-white/20"}`}
        >
          <Monitor className="h-5 w-5" />
        </button>
        <button className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-all">
          <Users className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
