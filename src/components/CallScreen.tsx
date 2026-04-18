import { useState, useEffect, useRef, useCallback } from "react";
import {
  Phone, PhoneOff, Video, VideoOff, Mic, MicOff,
  Volume2, VolumeX, Monitor, X, Maximize2, Minimize2,
  Lock,
} from "lucide-react";

export type CallType = "audio" | "video";

interface CallScreenProps {
  open: boolean;
  type: CallType;
  contactName: string;
  contactAvatar: string;
  onEnd: () => void;
}

export function CallScreen({ open, type, contactName, contactAvatar, onEnd }: CallScreenProps) {
  const [callState, setCallState] = useState<"ringing" | "connected" | "ended">("ringing");
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(type === "video");
  const [isSpeaker, setIsSpeaker] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hasStream, setHasStream] = useState(false);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Stop all tracks on the current stream
  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      setHasStream(false);
    }
  }, []);

  // Start camera+mic
  const startCamera = useCallback(async () => {
    stopStream();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      streamRef.current = stream;
      setHasStream(true);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
    } catch {
      setIsVideoOn(false);
    }
  }, [stopStream]);

  // Reset state when call opens
  useEffect(() => {
    if (!open) {
      stopStream();
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    setCallState("ringing");
    setDuration(0);
    setIsMuted(false);
    setIsVideoOn(type === "video");
    setIsSpeaker(false);

    const connectTimer = setTimeout(() => setCallState("connected"), 2000);
    return () => clearTimeout(connectTimer);
  }, [open, type, stopStream]);

  // Duration counter
  useEffect(() => {
    if (callState !== "connected") return;
    timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [callState]);

  // Start/stop camera when isVideoOn changes
  useEffect(() => {
    if (!open) return;
    if (isVideoOn) {
      startCamera();
    } else {
      stopStream();
    }
  }, [isVideoOn, open, startCamera, stopStream]);

  // Attach stream to video element when ref becomes available
  useEffect(() => {
    if (localVideoRef.current && streamRef.current) {
      localVideoRef.current.srcObject = streamRef.current;
    }
  }, [hasStream]);

  if (!open) return null;

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  };

  const handleEnd = () => {
    setCallState("ended");
    stopStream();
    if (timerRef.current) clearInterval(timerRef.current);
    setTimeout(onEnd, 500);
  };

  const toggleMute = () => {
    setIsMuted((prev) => {
      if (streamRef.current) {
        streamRef.current.getAudioTracks().forEach((t) => { t.enabled = prev; });
      }
      return !prev;
    });
  };

  const toggleVideo = () => setIsVideoOn((prev) => !prev);

  return (
    <div className={`fixed inset-0 z-[70] flex flex-col bg-background ${isFullscreen ? "" : "md:p-8 md:items-center md:justify-center"}`}>
      {/* Background */}
      <div className="absolute inset-0">
        <div className="pointer-events-none absolute top-1/4 left-1/4 h-96 w-96 rounded-full bg-primary/15 blur-3xl animate-float" />
        <div className="pointer-events-none absolute bottom-1/4 right-1/4 h-80 w-80 rounded-full bg-accent/15 blur-3xl animate-float" style={{ animationDelay: "2s" }} />
      </div>

      <div className={`relative flex flex-col flex-1 ${isFullscreen ? "" : "md:max-w-lg md:max-h-[700px] md:rounded-3xl md:border md:border-border/40 md:shadow-elegant"} overflow-hidden glass-strong`}>

        {/* Top bar */}
        <div className="flex items-center justify-between px-5 py-4 z-10">
          <div className="flex items-center gap-2">
            <Lock className="h-3 w-3 text-primary" />
            <span className="text-[10px] font-mono uppercase tracking-[0.15em] gradient-text font-semibold">
              encrypted {type} call
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setIsFullscreen((f) => !f)} className="hidden md:flex rounded-lg p-1.5 hover:bg-surface-hover transition-colors">
              {isFullscreen ? <Minimize2 className="h-4 w-4 text-muted-foreground" /> : <Maximize2 className="h-4 w-4 text-muted-foreground" />}
            </button>
            <button onClick={handleEnd} className="rounded-lg p-1.5 hover:bg-surface-hover transition-colors">
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 flex flex-col items-center justify-center z-10 px-6">
          {isVideoOn && hasStream ? (
            /* Video call view */
            <div className="relative w-full flex-1 flex items-center justify-center">
              {/* Remote video placeholder */}
              <div className="w-full h-full max-h-[60vh] rounded-3xl bg-black/30 border border-border/30 flex items-center justify-center overflow-hidden">
                <div className="flex flex-col items-center gap-4">
                  <div className="flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-secondary to-muted text-3xl font-bold text-foreground border border-border animate-pulse">
                    {contactAvatar}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {callState === "ringing" ? "Connecting..." : contactName}
                  </p>
                  {callState === "connected" && (
                    <p className="text-xs font-mono text-online">{formatDuration(duration)}</p>
                  )}
                </div>
              </div>

              {/* Local video PiP */}
              <div className="absolute bottom-4 right-4 w-28 h-40 md:w-36 md:h-48 rounded-2xl overflow-hidden border-2 border-primary/40 shadow-glow bg-black">
                <video ref={localVideoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
              </div>
            </div>
          ) : (
            /* Audio call view */
            <div className="flex flex-col items-center gap-6">
              <div className="relative">
                {callState === "ringing" && (
                  <div className="absolute inset-0 rounded-full gradient-primary opacity-30 animate-ping" style={{ animationDuration: "1.5s" }} />
                )}
                {callState === "connected" && (
                  <div className="absolute -inset-2 rounded-full border-2 border-primary/30 animate-pulse" />
                )}
                <div className="relative flex h-28 w-28 items-center justify-center rounded-full bg-gradient-to-br from-secondary to-muted text-3xl font-bold text-foreground border-2 border-border shadow-elegant">
                  {contactAvatar}
                </div>
              </div>

              <div className="text-center">
                <h2 className="text-2xl font-semibold text-foreground">{contactName}</h2>
                <p className={`text-sm font-mono mt-1 ${
                  callState === "ringing" ? "text-primary animate-pulse" :
                  callState === "ended" ? "text-destructive" : "text-online"
                }`}>
                  {callState === "ringing" ? "Calling..." : callState === "ended" ? "Call ended" : formatDuration(duration)}
                </p>
              </div>

              {callState === "connected" && !isMuted && (
                <div className="flex items-end gap-1 h-8">
                  {[...Array(12)].map((_, i) => (
                    <div
                      key={i}
                      className="w-1 rounded-full bg-primary/60"
                      style={{
                        height: `${Math.random() * 100}%`,
                        animation: `pulse ${0.5 + Math.random() * 0.5}s ease-in-out infinite alternate`,
                        animationDelay: `${i * 0.05}s`,
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="z-10 px-6 py-8">
          <div className="flex items-center justify-center gap-4">
            <CallButton icon={isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />} label={isMuted ? "Unmute" : "Mute"} active={isMuted} onClick={toggleMute} />
            <CallButton icon={isVideoOn ? <VideoOff className="h-5 w-5" /> : <Video className="h-5 w-5" />} label={isVideoOn ? "Cam Off" : "Cam On"} active={!isVideoOn && type === "video"} onClick={toggleVideo} />
            <button onClick={handleEnd} className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow-lg hover:scale-105 transition-all">
              <PhoneOff className="h-6 w-6" />
            </button>
            <CallButton icon={isSpeaker ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />} label={isSpeaker ? "Earpiece" : "Speaker"} active={isSpeaker} onClick={() => setIsSpeaker((s) => !s)} />
            <CallButton icon={<Monitor className="h-5 w-5" />} label="Share" onClick={() => {}} />
          </div>
        </div>
      </div>
    </div>
  );
}

function CallButton({ icon, label, active, onClick }: {
  icon: React.ReactNode; label: string; active?: boolean; onClick: () => void;
}) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-1.5">
      <div className={`flex h-12 w-12 items-center justify-center rounded-full transition-all hover:scale-105 ${
        active ? "bg-primary/20 text-primary border border-primary/40" : "bg-secondary/80 text-muted-foreground border border-border/40 hover:bg-surface-hover"
      }`}>
        {icon}
      </div>
      <span className="text-[10px] text-muted-foreground">{label}</span>
    </button>
  );
}
