import { ReactNode } from "react";
import { BottomNav } from "./BottomNav";

export const AppShell = ({ children, hideNav }: { children: ReactNode; hideNav?: boolean }) => (
  <div className="min-h-screen bg-background" style={{ paddingTop: "env(safe-area-inset-top)" }}>
    <div className="max-w-md mx-auto min-h-screen bg-background" style={{ paddingBottom: "calc(5rem + env(safe-area-inset-bottom))" }}>{children}</div>
    {!hideNav && <BottomNav />}
  </div>
);