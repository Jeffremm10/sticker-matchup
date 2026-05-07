import { ReactNode } from "react";
import { BottomNav } from "./BottomNav";

export const AppShell = ({ children, hideNav }: { children: ReactNode; hideNav?: boolean }) => (
  <div
    className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/10"
    style={{ paddingTop: "env(safe-area-inset-top)" }}
  >
    {/* Desktop decorative sides */}
    <div className="hidden md:flex fixed inset-y-0 left-0 right-0 items-center justify-center pointer-events-none">
      <div className="w-full max-w-md mx-auto h-full" />
    </div>

    <div
      className="max-w-md mx-auto min-h-screen bg-background shadow-xl relative"
      style={{ paddingBottom: "calc(5rem + env(safe-area-inset-bottom))" }}
    >
      {children}
    </div>
    {!hideNav && <BottomNav />}
  </div>
);
