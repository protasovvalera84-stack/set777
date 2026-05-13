import { useState, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";
import RegisterPage from "./pages/Register.tsx";
import NotFound from "./pages/NotFound.tsx";
import { ThemeProvider } from "./theme/ThemeProvider";
import { UserProfile, defaultProfile } from "@/data/mockData";
import { PlatformId } from "@/data/languages";
import { MeshProvider } from "@/lib/MeshProvider";
import { loadSession, clearSession, logoutAccount, type MeshlinkSession } from "@/lib/meshClient";
import { isDeviceAuthorized, registerDevice, verifyRecoveryWords, loadSecurityFromServer } from "@/lib/deviceSecurity";

const queryClient = new QueryClient();

const REGISTERED_KEY = "meshlink-registered";
const PROFILE_KEY = "meshlink-profile";

function loadRegistered(): boolean {
  return localStorage.getItem(REGISTERED_KEY) === "true";
}

function loadProfile(): UserProfile {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return defaultProfile;
}

const App = () => {
  const [registered, setRegistered] = useState(loadRegistered);
  const [profile, setProfile] = useState<UserProfile>(loadProfile);
  const [session, setSession] = useState<MeshlinkSession | null>(loadSession);
  const [validating, setValidating] = useState(true);
  const [deviceBlocked, setDeviceBlocked] = useState(false);
  const [recoveryWords, setRecoveryWords] = useState<string[] | null>(null);
  const [showRecoverySetup, setShowRecoverySetup] = useState(false);

  // Device security check after session loads
  useEffect(() => {
    if (!session) { setDeviceBlocked(false); return; }
    (async () => {
      try {
        const result = await isDeviceAuthorized(session.homeserverUrl, session.accessToken, session.userId);
        if (result.isNewDevice) {
          setDeviceBlocked(true);
        } else if (!result.deviceId) {
          // First device — register and show recovery words
          const reg = await registerDevice(session.homeserverUrl, session.accessToken, session.userId);
          if (reg.recoveryWords) {
            setRecoveryWords(reg.recoveryWords);
            setShowRecoverySetup(true);
          }
        }
      } catch { /* ignore on error */ }
    })();
  }, [session]);

  // Request notification permission
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  // Load saved font size
  useEffect(() => {
    const saved = localStorage.getItem("meshlink-fontsize");
    if (saved) document.documentElement.style.fontSize = `${saved}px`;
  }, []);

  // Validate session on load -- check if token is still valid
  useEffect(() => {
    const sess = loadSession();
    if (!sess) {
      setValidating(false);
      return;
    }

    // Quick check: can we reach the server with this token?
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    fetch(`${sess.homeserverUrl}/_matrix/client/v3/account/whoami`, {
      headers: { Authorization: `Bearer ${sess.accessToken}` },
      signal: controller.signal,
    })
      .then((resp) => {
        clearTimeout(timeoutId);
        if (!resp.ok) {
          // Token invalid -- force re-login
          console.warn("Session token invalid, clearing");
          localStorage.removeItem(REGISTERED_KEY);
          clearSession();
          setRegistered(false);
          setSession(null);
        }
        setValidating(false);
      })
      .catch(() => {
        clearTimeout(timeoutId);
        // Network error -- proceed anyway, MeshProvider will handle it
        setValidating(false);
      });
  }, []);

  const handleRegisterComplete = (newProfile: UserProfile, _lang: string, _platform: PlatformId | null) => {
    setProfile(newProfile);
    setRegistered(true);
    localStorage.setItem(REGISTERED_KEY, "true");
    localStorage.setItem(PROFILE_KEY, JSON.stringify(newProfile));
    setSession(loadSession());
  };

  const handleLogout = () => {
    if (!window.confirm("Are you sure you want to log out?")) return;
    if (session) {
      logoutAccount(session).catch(() => {});
    }
    localStorage.removeItem(REGISTERED_KEY);
    localStorage.removeItem(PROFILE_KEY);
    clearSession();
    setRegistered(false);
    setProfile(defaultProfile);
    setSession(null);
  };

  // Persist profile changes from settings
  useEffect(() => {
    if (registered) {
      localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    }
  }, [profile, registered]);

  // Show nothing while validating session
  if (validating) {
    return (
      <ThemeProvider>
        <div className="flex h-screen w-full items-center justify-center bg-background">
          <div className="flex flex-col items-center gap-3">
            <div className="h-10 w-10 rounded-2xl gradient-primary animate-pulse" />
            <p className="text-xs text-muted-foreground">Loading...</p>
          </div>
        </div>
      </ThemeProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          {registered && session ? (
            deviceBlocked ? (
              <DeviceVerification session={session} onVerified={() => setDeviceBlocked(false)} onLogout={handleLogout} />
            ) : showRecoverySetup && recoveryWords ? (
              <RecoveryWordsSetup words={recoveryWords} onDone={() => { localStorage.setItem("meshlink-recovery-words", JSON.stringify(recoveryWords)); setShowRecoverySetup(false); setRecoveryWords(null); }} />
            ) : (
              <MeshProvider session={session}>
                <BrowserRouter>
                  <Routes>
                    <Route path="/" element={<Index initialProfile={profile} onProfileChange={setProfile} onLogout={handleLogout} />} />
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </BrowserRouter>
              </MeshProvider>
            )
          ) : (
            <RegisterPage onComplete={handleRegisterComplete} />
          )}
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

/* ===== Recovery Words Setup (shown once after first registration) ===== */
function RecoveryWordsSetup({ words, onDone }: { words: string[]; onDone: () => void }) {
  const [confirmed, setConfirmed] = useState(false);
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex h-screen w-full items-center justify-center bg-background p-4">
      <div className="w-full max-w-md rounded-3xl border border-border/60 bg-card p-6 shadow-xl">
        <h2 className="text-xl font-bold text-center mb-2">Recovery Words</h2>
        <p className="text-sm text-muted-foreground text-center mb-4">
          Save these 20 words securely. You will need them to access your account from a new device.
        </p>
        <div className="grid grid-cols-4 gap-2 mb-4 p-4 rounded-2xl bg-secondary/50 border border-border/40">
          {words.map((w, i) => (
            <div key={i} className="text-center">
              <span className="text-[9px] text-muted-foreground">{i + 1}.</span>
              <p className="text-xs font-mono font-semibold text-foreground">{w}</p>
            </div>
          ))}
        </div>
        <button onClick={() => { navigator.clipboard.writeText(words.map((w, i) => `${i + 1}. ${w}`).join("\n")).then(() => setCopied(true)); }}
          className="w-full mb-3 rounded-xl py-2 text-sm border border-border/50 hover:bg-surface-hover transition-all">
          {copied ? "Copied!" : "Copy to clipboard"}
        </button>
        <label className="flex items-center gap-2 mb-4 cursor-pointer">
          <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="rounded" />
          <span className="text-xs text-muted-foreground">I have saved these words in a safe place</span>
        </label>
        <button onClick={onDone} disabled={!confirmed}
          className={`w-full rounded-xl py-3 text-sm font-semibold transition-all ${confirmed ? "gradient-primary text-primary-foreground shadow-glow" : "bg-secondary text-muted-foreground cursor-not-allowed"}`}>
          Continue
        </button>
      </div>
    </div>
  );
}

/* ===== Device Verification (shown when logging in from new device) ===== */
function DeviceVerification({ session, onVerified, onLogout }: { session: MeshlinkSession; onVerified: () => void; onLogout: () => void }) {
  const [wordInputs, setWordInputs] = useState<string[]>(Array(20).fill(""));
  const [error, setError] = useState("");
  const [verifying, setVerifying] = useState(false);

  const handleVerify = async () => {
    setError("");
    setVerifying(true);
    try {
      const serverData = await loadSecurityFromServer(session.homeserverUrl, session.accessToken, session.userId);
      if (!serverData?.wordHash) { setError("No recovery data found on server."); setVerifying(false); return; }
      const valid = await verifyRecoveryWords(wordInputs, serverData.wordHash);
      if (valid) {
        await registerDevice(session.homeserverUrl, session.accessToken, session.userId);
        onVerified();
      } else {
        setError("Incorrect recovery words. Please try again.");
      }
    } catch { setError("Verification failed. Check connection."); }
    setVerifying(false);
  };

  return (
    <div className="flex h-screen w-full items-center justify-center bg-background p-4">
      <div className="w-full max-w-md rounded-3xl border border-border/60 bg-card p-6 shadow-xl">
        <div className="text-center mb-4">
          <div className="mx-auto mb-3 h-12 w-12 rounded-full bg-amber-500/20 flex items-center justify-center">
            <span className="text-2xl">&#9888;</span>
          </div>
          <h2 className="text-xl font-bold">New Device Detected</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Enter your 20 recovery words to authorize this device.
          </p>
        </div>
        <div className="grid grid-cols-4 gap-1.5 mb-4">
          {wordInputs.map((w, i) => (
            <div key={i} className="relative">
              <span className="absolute left-1.5 top-1 text-[8px] text-muted-foreground">{i + 1}</span>
              <input type="text" value={w} onChange={(e) => { const n = [...wordInputs]; n[i] = e.target.value.toLowerCase().trim(); setWordInputs(n); }}
                className="w-full rounded-lg bg-secondary border border-border/40 px-1.5 pt-4 pb-1 text-[11px] font-mono text-foreground outline-none focus:border-primary/50" />
            </div>
          ))}
        </div>
        {error && <p className="text-xs text-destructive text-center mb-3">{error}</p>}
        <button onClick={handleVerify} disabled={verifying || wordInputs.some(w => !w)}
          className={`w-full rounded-xl py-3 text-sm font-semibold transition-all ${!verifying && wordInputs.every(w => w) ? "gradient-primary text-primary-foreground shadow-glow" : "bg-secondary text-muted-foreground cursor-not-allowed"}`}>
          {verifying ? "Verifying..." : "Verify & Authorize Device"}
        </button>
        <button onClick={onLogout} className="w-full mt-2 rounded-xl py-2 text-sm text-muted-foreground hover:text-destructive transition-all">
          Log out instead
        </button>
      </div>
    </div>
  );
}

export default App;
