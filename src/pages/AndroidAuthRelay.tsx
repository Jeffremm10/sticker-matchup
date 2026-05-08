import { useEffect, useState } from "react";

// Loaded in Chrome Custom Tab after Android OAuth.
// Reads tokens from URL hash and relays them to the native app via deep link.
export default function AndroidAuthRelay() {
  const [attempted, setAttempted] = useState(false);

  useEffect(() => {
    const raw = window.location.hash.slice(1) || window.location.search.slice(1);
    if (!raw) return;
    const params = new URLSearchParams(raw);
    if (!params.get("access_token")) return;

    const deepLink = `io.swapstrat.app://login-callback#${raw}`;
    window.location.href = deepLink;
    setAttempted(true);
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center p-8 text-center">
      <div>
        <p className="text-lg font-semibold mb-4">Completing sign-in…</p>
        {attempted && (
          <>
            <p className="text-sm text-muted-foreground mb-4">
              If SwapStrat didn't open automatically, tap below.
            </p>
            <a
              href={`io.swapstrat.app://login-callback${window.location.hash || ("?" + window.location.search)}`}
              className="inline-block px-6 py-3 bg-primary text-primary-foreground rounded-xl font-bold"
            >
              Open SwapStrat
            </a>
          </>
        )}
      </div>
    </div>
  );
}
