import { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import Auth from "./pages/Auth";
import Album from "./pages/Album";
import Landing from "./pages/Landing";
import Download from "./pages/Download";
import OnboardingUsername from "./pages/OnboardingUsername";
import OnboardingLocation from "./pages/OnboardingLocation";
import Matches from "./pages/Matches";
import Chat from "./pages/Chat";
import Profile from "./pages/Profile";
import Swipe from "./pages/Swipe";
import NotFound from "./pages/NotFound";
import { MessageNotifications } from "./hooks/useMessageNotifications";
import { PaywallProvider } from "./providers/PaywallProvider";

// Relay component: runs inside Chrome Custom Tab (Lovable domain, not localhost).
// Handles two cases:
//   1. OAuth: access_token in URL hash → relay to native deep link
//   2. Payment: payment_success=1 in query string → show return page
function NativeRelay() {
  const [deepLink, setDeepLink] = useState<string | null>(null);
  const [isPayment, setIsPayment] = useState(false);

  useEffect(() => {
    if (window.location.hostname === "localhost") return;

    // OAuth relay: tokens in hash
    const hash = window.location.hash.slice(1);
    if (hash) {
      const p = new URLSearchParams(hash);
      if (p.get("access_token") && p.get("refresh_token")) {
        const link = `io.swapstrat.app://login-callback#${hash}`;
        setDeepLink(link);
        window.location.href = link;
        return;
      }
    }

    // Payment relay: payment_success in query string
    const search = window.location.search.slice(1);
    if (search) {
      const p = new URLSearchParams(search);
      if (p.get("payment_success") === "1") {
        const link = `io.swapstrat.app://payment-return?${search}`;
        setDeepLink(link);
        setIsPayment(true);
        // Android Chrome Custom Tab blocks programmatic custom-scheme navigation without
        // a user gesture. Use the Android intent URI instead — Chrome handles it
        // natively, closes the tab immediately, and brings the app to foreground.
        const isAndroid = /android/i.test(navigator.userAgent);
        if (isAndroid) {
          window.location.href = `intent://payment-return?${search}#Intent;scheme=io.swapstrat.app;package=io.swapstrat.app;end`;
        } else {
          window.location.href = link;
        }
        return;
      }
    }
  }, []);

  if (!deepLink) return null;

  // Fallback UI — shown if the automatic redirect above didn't close the tab.
  const isAndroid = /android/i.test(navigator.userAgent);
  const buttonHref = isAndroid
    ? `intent://payment-return?${deepLink.split("?")[1] ?? ""}#Intent;scheme=io.swapstrat.app;package=io.swapstrat.app;end`
    : deepLink;

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      padding: 32, background: "#fff", textAlign: "center", fontFamily: "sans-serif",
    }}>
      {isPayment ? (
        <>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🎉</div>
          <p style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>Payment complete!</p>
          <p style={{ fontSize: 15, color: "#666", marginBottom: 32 }}>Tap below to return to SwapStrat and unlock your purchase.</p>
        </>
      ) : (
        <>
          <p style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Completing sign-in…</p>
          <p style={{ fontSize: 14, color: "#888", marginBottom: 24 }}>Tap below if SwapStrat didn't open automatically.</p>
        </>
      )}
      <a href={buttonHref} style={{
        display: "inline-block", padding: "16px 36px",
        background: "#6366f1", color: "#fff", borderRadius: 16,
        fontWeight: 800, fontSize: 17, textDecoration: "none",
      }}>
        {isPayment ? "Return to SwapStrat" : "Open SwapStrat"}
      </a>
    </div>
  );
}

const queryClient = new QueryClient();

const Protected = ({ children, requireUsername = true }: { children: JSX.Element; requireUsername?: boolean }) => {
  const { user, loading } = useAuth();
  const { data: profile, isLoading: pLoading } = useProfile();
  if (loading || (user && pLoading)) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading…</div>;
  if (!user) return <Navigate to="/auth" replace />;
  if (requireUsername && !profile?.username) return <Navigate to="/onboarding/username" replace />;
  if (requireUsername && profile?.username && profile?.lat == null) return <Navigate to="/onboarding/location" replace />;
  return children;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <NativeRelay />
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <PaywallProvider>
            <MessageNotifications />
            <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/download" element={<Download />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/onboarding/username" element={<Protected requireUsername={false}><OnboardingUsername /></Protected>} />
            <Route path="/onboarding/location" element={<Protected requireUsername={false}><OnboardingLocation /></Protected>} />
            <Route path="/album" element={<Protected><Album /></Protected>} />
            <Route path="/swipe" element={<Protected><Swipe /></Protected>} />
<Route path="/matches" element={<Protected><Matches /></Protected>} />
            <Route path="/chat/:id" element={<Protected><Chat /></Protected>} />
            <Route path="/profile" element={<Protected><Profile /></Protected>} />
            <Route path="*" element={<NotFound />} />
            </Routes>
          </PaywallProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
