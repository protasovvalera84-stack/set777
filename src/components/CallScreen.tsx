import { useState, useEffect, useRef, useCallback } from "react";
import {
  Phone, PhoneOff, Video, VideoOff, Mic, MicOff,
  Volume2, X, Maximize2, Minimize2,
  Lock, Monitor, MonitorOff,
} from "lucide-react";
import type { MatrixCall } from "matrix-js-sdk/lib/webrtc/call";
import { CallState, CallEvent } from "matrix-js-sdk/lib/webrtc/call";

export type CallType = "audio" | "video";

interface CallScreenProps {
  open: boolean;
  type: CallType;
  contactName: string;
  contactAvatar: string;
  matrixCall: MatrixCall | null;
  onEnd: () => void;
}

export function CallScreen({ open, type, contactName, contactAvatar, matrixCall, onEnd }: CallScreenProps) {
  const [callState, setCallState] = useState<"ringing" | "connecting" | "connected" | "ended">("ringing");
  const [callError, setCallError] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(type === "video");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  // Reactive stream tracking -- forces re-render when streams change
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);

  // Grab streams from the call object
  const updateStreams = useCallback(() => {
    if (!matrixCall) return;

    const remote = matrixCall.remoteUsermediaFeed?.stream || null;
    const local = matrixCall.localUsermediaFeed?.stream || null;

    setRemoteStream((prev) => (prev !== remote ? remote : prev));
    setLocalStream((prev) => (prev !== local ? local : prev));
  }, [matrixCall]);

  // Attach Matrix call events
  useEffect(() => {
    if (!matrixCall || !open) return;

    const onStateChange = (state: CallState) => {
      console.log("Call state:", state);
      switch (state) {
        case CallState.Ringing:
        case CallState.InviteSent:
        case CallState.WaitLocalMedia:
        case CallState.CreateOffer:
        case CallState.CreateAnswer:
          setCallState("ringing");
          break;
        case CallState.Connecting:
          setCallState("connecting");
          break;
        case CallState.Connected:
          setCallState("connected");
          updateStreams();
          break;
        case CallState.Ended:
          setCallState("ended");
          setTimeout(onEnd, 1000);
          break;
      }
    };

    const onFeedsChanged = () => {
      console.log("Feeds changed, remote:", !!matrixCall.remoteUsermediaFeed, "local:", !!matrixCall.localUsermediaFeed);
      updateStreams();
    };

    const onError = (err: { message?: string; code?: string }) => {
      console.error("Call error:", err);
      setCallError(err?.message || err?.code || "Call failed");
    };

    matrixCall.on(CallEvent.State, onStateChange);
    matrixCall.on(CallEvent.FeedsChanged, onFeedsChanged);
    matrixCall.on(CallEvent.Error, onError);

    // Set initial state
    onStateChange(matrixCall.state);
    updateStreams();

    // Poll for streams every 500ms as backup (feeds events can be unreliable)
    const streamPoll = setInterval(updateStreams, 500);

    return () => {
      matrixCall.removeListener(CallEvent.State, onStateChange);
      matrixCall.removeListener(CallEvent.FeedsChanged, onFeedsChanged);
      matrixCall.removeListener(CallEvent.Error, onError);
      clearInterval(streamPoll);
    };
  }, [matrixCall, open, onEnd, updateStreams]);

  // Attach remote stream to video/audio elements
  useEffect(() => {
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  // Attach local stream to video element
  useEffect(() => {
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  // Duration counter
  useEffect(() => {
    if (callState !== "connected") {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    setDuration(0);
    timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [callState]);

  // Cleanup on close
  useEffect(() => {
    if (!open) {
      setDuration(0);
      setCallState("ringing");
      setCallError(null);
      setIsMuted(false);
      setRemoteStream(null);
      setLocalStream(null);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  }, [open]);

  if (!open) return null;

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  };

  const handleEnd = () => {
    if (matrixCall) {
      try { matrixCall.hangup("user_hangup", false); } catch { /* ok */ }
    }
    setCallState("ended");
    if (timerRef.current) clearInterval(timerRef.current);
    setTimeout(onEnd, 500);
  };

  const toggleMute = () => {
    if (!matrixCall) return;
    const newMuted = !isMuted;
    matrixCall.setMicrophoneMuted(newMuted);
    setIsMuted(newMuted);
  };

  const toggleVideo = () => {
    if (!matrixCall) return;
    const newVideoOn = !isVideoOn;
    matrixCall.setLocalVideoMuted(!newVideoOn);
    setIsVideoOn(newVideoOn);
  };

  const toggleScreenShare = async () => {
    if (!matrixCall) return;
    if (isScreenSharing) {
      // Stop screen share - revert to camera
      const camStream = await navigator.mediaDevices.getUserMedia({ video: true });
      const sender = (matrixCall as any).peerConn?.getSenders()?.find((s: any) => s.track?.kind === "video");
      if (sender && camStream.getVideoTracks()[0]) {
        sender.replaceTrack(camStream.getVideoTracks()[0]);
      }
      setIsScreenSharing(false);
    } else {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        const screenTrack = screenStream.getVideoTracks()[0];
        const sender = (matrixCall as any).peerConn?.getSenders()?.find((s: any) => s.track?.kind === "video");
        if (sender) {
          sender.replaceTrack(screenTrack);
        }
        screenTrack.onended = () => {
          setIsScreenSharing(false);
          toggleVideo();
        };
        setIsScreenSharing(true);
        setIsVideoOn(true);
      } catch {
        // User cancelled screen share picker
      }
    }
  };

  const hasRemoteVideo = remoteStream ? remoteStream.getVideoTracks().length > 0 : false;
  const hasLocalVideo = localStream ? localStream.getVideoTracks().length > 0 : false;
  const isVideoCall = type === "video" || hasRemoteVideo || hasLocalVideo;

  const statusText = callError ? callError :
    callState === "ringing" ? "Calling..." :
    callState === "connecting" ? "Connecting..." :
    callState === "ended" ? "Call ended" :
    formatDuration(duration);

  return (
    <div className={`fixed inset-0 z-[70] flex flex-col bg-background ${isFullscreen ? "" : "md:p-8 md:items-center md:justify-center"}`}>
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
              {type} call
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
        <div className="flex-1 flex flex-col items-center justify-center z-10 px-4">
          {isVideoCall ? (
            <div className="relative w-full flex-1 flex items-center justify-center">
              {/* Remote video (large) -- always rendered, hidden when no stream */}
              <div className="w-full h-full max-h-[65vh] rounded-3xl bg-black border border-border/30 overflow-hidden">
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  className={`w-full h-full object-cover ${hasRemoteVideo && remoteStream ? "" : "hidden"}`}
                />
                {/* Avatar placeholder when no remote video */}
                {(!hasRemoteVideo || !remoteStream) && (
                  <div className="w-full h-full flex flex-col items-center justify-center gap-4">
                    <div className="flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-secondary to-muted text-3xl font-bold text-foreground border border-border animate-pulse">
                      {contactAvatar}
                    </div>
                    <p className="text-sm text-muted-foreground">{contactName}</p>
                    <p className={`text-xs font-mono ${callState === "connected" ? "text-online" : "text-primary animate-pulse"}`}>
                      {statusText}
                    </p>
                  </div>
                )}
              </div>

              {/* Local video PiP (small, bottom-right) -- always rendered */}
              <div className={`absolute bottom-3 right-3 w-24 h-32 md:w-32 md:h-44 rounded-2xl overflow-hidden border-2 border-primary/50 shadow-glow bg-black ${hasLocalVideo && localStream ? "" : "hidden"}`}>
                <video
                  ref={localVideoRef}
                  autoPlay
                  muted
                  playsInline
                  className="w-full h-full object-cover"
                  style={{ transform: "scaleX(-1)" }}
                />
              </div>

              {/* Duration overlay */}
              {callState === "connected" && (
                <div className="absolute top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-black/60 backdrop-blur-sm">
                  <p className="text-xs font-mono text-white">{formatDuration(duration)}</p>
                </div>
              )}
            </div>
          ) : (
            /* Audio call view */
            <div className="flex flex-col items-center gap-6">
              <div className="relative">
                {(callState === "ringing" || callState === "connecting") && (
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
                  callState === "connected" ? "text-online" :
                  callState === "ended" ? "text-destructive" : "text-primary animate-pulse"
                }`}>
                  {statusText}
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

        {/* Hidden audio element for remote audio (always present) */}
        <audio ref={remoteAudioRef} autoPlay />

        {/* Controls */}
        <div className="z-10 px-6 py-6">
          <div className="flex items-center justify-center gap-4">
            <CallButton icon={isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />} label={isMuted ? "Unmute" : "Mute"} active={isMuted} onClick={toggleMute} />
            <CallButton icon={isVideoOn ? <VideoOff className="h-5 w-5" /> : <Video className="h-5 w-5" />} label={isVideoOn ? "Cam Off" : "Cam On"} active={!isVideoOn && type === "video"} onClick={toggleVideo} />
            <button onClick={handleEnd} className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow-lg hover:scale-105 transition-all">
              <PhoneOff className="h-6 w-6" />
            </button>
            <CallButton icon={isScreenSharing ? <MonitorOff className="h-5 w-5" /> : <Monitor className="h-5 w-5" />} label={isScreenSharing ? "Stop Share" : "Share Screen"} active={isScreenSharing} onClick={toggleScreenShare} />
            <CallButton icon={<Volume2 className="h-5 w-5" />} label="Speaker" active={false} onClick={() => {}} />
          </div>
        </div>
      </div>
    </div>
  );
}

/** Incoming call notification banner */
export function IncomingCallBanner({ callerName, onAccept, onReject }: {
  callerName: string;
  onAccept: (video: boolean) => void;
  onReject: () => void;
}) {
  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[80] w-full max-w-sm animate-fade-in-up">
      <div className="rounded-3xl glass-strong border border-primary/40 shadow-elegant p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full gradient-primary text-primary-foreground font-bold animate-pulse">
            <Phone className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-foreground">{callerName}</p>
            <p className="text-xs text-muted-foreground">Incoming call...</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => onAccept(false)}
            className="flex-1 flex items-center justify-center gap-2 rounded-2xl py-2.5 bg-online/20 text-online border border-online/30 text-sm font-medium hover:bg-online/30 transition-all"
          >
            <Phone className="h-4 w-4" /> Audio
          </button>
          <button
            onClick={() => onAccept(true)}
            className="flex-1 flex items-center justify-center gap-2 rounded-2xl py-2.5 gradient-primary text-primary-foreground text-sm font-medium hover:scale-[1.02] transition-all"
          >
            <Video className="h-4 w-4" /> Video
          </button>
          <button
            onClick={onReject}
            className="flex items-center justify-center rounded-2xl px-4 py-2.5 bg-destructive/20 text-destructive border border-destructive/30 hover:bg-destructive/30 transition-all"
          >
            <PhoneOff className="h-4 w-4" />
          </button>
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
