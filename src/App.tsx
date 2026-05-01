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
            <MeshProvider session={session}>
              <BrowserRouter>
                <Routes>
                  <Route path="/" element={<Index initialProfile={profile} onProfileChange={setProfile} onLogout={handleLogout} />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </BrowserRouter>
            </MeshProvider>
          ) : (
            <RegisterPage onComplete={handleRegisterComplete} />
          )}
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

export default App;
