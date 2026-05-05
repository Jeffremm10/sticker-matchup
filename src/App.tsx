import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import Auth from "./pages/Auth";
import Album from "./pages/Album";
import OnboardingUsername from "./pages/OnboardingUsername";
import OnboardingLocation from "./pages/OnboardingLocation";
import Matches from "./pages/Matches";
import Chat from "./pages/Chat";
import Profile from "./pages/Profile";
import Swipe from "./pages/Swipe";
import Meet from "./pages/Meet";
import NotFound from "./pages/NotFound";
import { MessageNotifications } from "./hooks/useMessageNotifications";
import { PaywallProvider } from "./providers/PaywallProvider";

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
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <PaywallProvider>
            <MessageNotifications />
            <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/onboarding/username" element={<Protected requireUsername={false}><OnboardingUsername /></Protected>} />
            <Route path="/onboarding/location" element={<Protected requireUsername={false}><OnboardingLocation /></Protected>} />
            <Route path="/" element={<Protected><Album /></Protected>} />
            <Route path="/album" element={<Protected><Album /></Protected>} />
            <Route path="/swipe" element={<Protected><Swipe /></Protected>} />
            <Route path="/meet" element={<Protected><Meet /></Protected>} />
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
