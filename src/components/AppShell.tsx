import { ReactNode } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { BookOpen, Flame, MessageCircle, User, Crown } from "lucide-react";
import { cn } from "@/lib/utils";
import { BottomNav } from "./BottomNav";
import { useProfile } from "@/hooks/useProfile";

const NAV_ITEMS = [
  { to: "/album",   label: "Album",   icon: BookOpen },
  { to: "/swipe",   label: "Swipe",   icon: Flame },
  { to: "/matches", label: "Chat",    icon: MessageCircle },
  { to: "/profile", label: "Profile", icon: User },
];

function DesktopSidebar() {
  const { data: profile } = useProfile();
  const nav = useNavigate();
  return (
    <aside className="hidden md:flex flex-col fixed left-0 top-0 h-full w-56 bg-card border-r border-border z-40 px-3 py-6">
      {/* Logo */}
      <div className="flex items-center gap-2 px-3 mb-8 cursor-pointer" onClick={() => nav("/swipe")}>
        <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center">
          <Flame className="w-4 h-4 text-primary-foreground" />
        </div>
        <span className="font-black text-lg">SwapStrat</span>
      </div>

      {/* Nav links */}
      <nav className="flex flex-col gap-1 flex-1">
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} end
            className={({ isActive }) => cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors",
              isActive
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            )}>
            <Icon className="w-4 h-4 shrink-0" />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Profile footer */}
      {profile && (
        <div className="mt-auto px-3 py-3 rounded-xl bg-secondary flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-black">
            {profile.display_name?.[0] ?? "?"}
          </div>
          <div className="min-w-0">
            <div className="text-xs font-bold truncate">{profile.display_name}</div>
            {profile.is_pro && (
              <div className="flex items-center gap-1 text-[10px] text-amber-500 font-semibold">
                <Crown className="w-2.5 h-2.5" /> PRO
              </div>
            )}
          </div>
        </div>
      )}
    </aside>
  );
}

export const AppShell = ({ children, hideNav }: { children: ReactNode; hideNav?: boolean }) => (
  <div className="min-h-screen bg-background" style={{ paddingTop: "env(safe-area-inset-top)" }}>
    {!hideNav && <DesktopSidebar />}

    {/* Content: shifts right on desktop to account for sidebar */}
    <div
      className={cn(
        "min-h-screen bg-background transition-all",
        !hideNav && "md:ml-56"
      )}
      style={{ paddingBottom: "calc(5rem + env(safe-area-inset-bottom))" }}
    >
      {/* Mobile: keep narrow centered layout; desktop: full width up to xl */}
      <div className="max-w-md mx-auto md:max-w-none md:mx-0">
        {children}
      </div>
    </div>

    {/* Bottom nav: mobile only */}
    {!hideNav && <BottomNav />}
  </div>
);
