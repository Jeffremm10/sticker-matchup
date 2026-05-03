import { NavLink } from "react-router-dom";
import { Layers, Flame, MessageCircle, User } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { to: "/", label: "Swipe", icon: Flame },
  { to: "/collection", label: "Collection", icon: Layers },
  { to: "/matches", label: "Matches", icon: MessageCircle },
  { to: "/profile", label: "Profile", icon: User },
];

export const BottomNav = () => (
  <nav className="fixed bottom-0 inset-x-0 z-40 bg-card border-t border-border max-w-md mx-auto">
    <div className="grid grid-cols-4">
      {items.map(({ to, label, icon: Icon }) => (
        <NavLink key={to} to={to} end
          className={({ isActive }) => cn(
            "flex flex-col items-center justify-center py-2 text-[11px] gap-0.5",
            isActive ? "text-primary font-bold" : "text-muted-foreground"
          )}>
          <Icon className="w-5 h-5" />{label}
        </NavLink>
      ))}
    </div>
  </nav>
);