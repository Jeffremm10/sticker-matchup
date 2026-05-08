import { ReactNode } from "react";
import { NavLink, useNavigate, Link } from "react-router-dom";
import { BookOpen, Flame, MessageCircle, User, Crown, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { BottomNav } from "./BottomNav";
import { useProfile } from "@/hooks/useProfile";

const NAV_ITEMS = [
  { to: "/album",   label: "Album",    icon: BookOpen },
  { to: "/swipe",   label: "Discover", icon: Flame },
  { to: "/matches", label: "Matches",  icon: MessageCircle },
  { to: "/profile", label: "Profile",  icon: User },
];

function DesktopSidebar() {
  const { data: profile } = useProfile();
  const nav = useNavigate();

  return (
    <aside className="hidden md:flex flex-col fixed left-0 top-0 h-full w-56 bg-card border-r border-border z-40 px-3 py-6">
      {/* Logo */}
      <button
        onClick={() => nav("/swipe")}
        className="flex items-center gap-2 px-3 mb-8 hover:opacity-80 transition-opacity"
      >
        <span className="font-black text-lg text-primary">SwapStrat</span>
      </button>

      {/* Nav */}
      <nav className="flex flex-col gap-1 flex-1">
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end
            className={({ isActive }) => cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all",
              isActive
                ? "bg-primary/10 text-primary border border-primary/20"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            )}
          >
            <Icon className="w-4 h-4 shrink-0" />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Download link — web only */}
      {window.location.hostname !== "localhost" && (
        <Link
          to="/download"
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-all mb-2"
        >
          <Download className="w-4 h-4 shrink-0" />
          Get the app
        </Link>
      )}

      {/* Profile footer */}
      {profile && (
        <NavLink
          to="/profile"
          className="mt-auto px-3 py-3 rounded-xl border border-border hover:border-primary/30 transition-colors flex items-center gap-3"
        >
          <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-xs font-black text-primary shrink-0">
            {profile.display_name?.[0]?.toUpperCase() ?? "?"}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-bold truncate">{profile.display_name}</div>
            {profile.is_pro ? (
              <div className="flex items-center gap-1 text-[10px] text-primary font-semibold">
                <Crown className="w-2.5 h-2.5" /> PRO
              </div>
            ) : (
              <div className="text-[10px] text-muted-foreground">Free plan</div>
            )}
          </div>
        </NavLink>
      )}
    </aside>
  );
}

export const AppShell = ({ children, hideNav }: { children: ReactNode; hideNav?: boolean }) => (
  <div className="min-h-screen bg-background" style={{ paddingTop: "env(safe-area-inset-top)" }}>
    {!hideNav && <DesktopSidebar />}

    <div
      className={cn(
        "min-h-screen bg-background transition-all",
        !hideNav && "md:ml-56"
      )}
      style={{ paddingBottom: "calc(5rem + env(safe-area-inset-bottom))" }}
    >
      <div className="max-w-md mx-auto md:max-w-none md:mx-0">
        {children}
      </div>
    </div>

    {!hideNav && <BottomNav />}
  </div>
);
