import { ReactNode } from "react";
import { BottomNav } from "./BottomNav";

export const AppShell = ({ children, hideNav }: { children: ReactNode; hideNav?: boolean }) => (
  <div className="min-h-screen bg-background">
    <div className="max-w-md mx-auto pb-20 min-h-screen bg-background">{children}</div>
    {!hideNav && <BottomNav />}
  </div>
);