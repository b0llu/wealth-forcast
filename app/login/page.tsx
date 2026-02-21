"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../components/auth-context";

/* Google "G" logo SVG */
function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path
        d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
        fill="#4285F4"
      />
      <path
        d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z"
        fill="#34A853"
      />
      <path
        d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
        fill="#FBBC05"
      />
      <path
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
        fill="#EA4335"
      />
    </svg>
  );
}

/* Animated background sparkline decoration */
function BackgroundChart() {
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.04]"
      viewBox="0 0 800 600"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <path
        d="M0 500 C100 480 150 420 200 380 C250 340 280 300 340 260 C400 220 420 200 480 160 C540 120 580 100 640 80 C700 60 750 55 800 50"
        fill="none"
        stroke="#ffae04"
        strokeWidth="2"
      />
      <path
        d="M0 550 C80 530 130 490 190 450 C250 410 290 380 360 340 C430 300 460 270 520 240 C580 210 620 195 680 170 C740 145 770 135 800 120"
        fill="none"
        stroke="#2671f4"
        strokeWidth="1.5"
      />
    </svg>
  );
}

export default function LoginPage() {
  const { user, isLoading, signInWithGoogle } = useAuth();
  const router = useRouter();
  const [isPending, setPending] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  /* If already signed in, go to the app */
  useEffect(() => {
    if (!isLoading && user) {
      router.replace("/investments");
    }
  }, [user, isLoading, router]);

  const handleSignIn = async () => {
    setAuthError(null);
    setPending(true);
    try {
      await signInWithGoogle();
      // onAuthStateChanged in AuthContext will update user → useEffect above will redirect
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Sign-in failed. Please try again.";
      // Ignore popup-closed-by-user silently
      if (!msg.includes("popup-closed") && !msg.includes("cancelled")) {
        setAuthError(msg);
      }
    } finally {
      setPending(false);
    }
  };

  /* Loading state while auth resolves */
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-[#ffae04]" />
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4">
      {/* Decorative background */}
      <BackgroundChart />

      {/* Radial glow behind card */}
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
        style={{
          width: "600px",
          height: "600px",
          background:
            "radial-gradient(ellipse at center, rgba(255,174,4,0.06) 0%, transparent 65%)",
        }}
        aria-hidden="true"
      />

      {/* Login card */}
      <div className="animate-fade-in-up relative z-10 w-full max-w-sm">
        {/* Brand */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#ffae04]/10 ring-1 ring-[#ffae04]/20">
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
              <path
                d="M3 17L8 10.5L12 14L18 6"
                stroke="#ffae04"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Wealth Forecast</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            AI-powered portfolio projections
          </p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-border bg-card p-7 shadow-2xl">
          <h2 className="mb-1 text-base font-semibold text-card-foreground">Welcome back</h2>
          <p className="mb-6 text-sm text-muted-foreground">
            Sign in to access your personal portfolio and wealth projections.
          </p>

          {/* Google Sign-In */}
          <button
            type="button"
            onClick={handleSignIn}
            disabled={isPending}
            className={[
              "group relative flex w-full items-center justify-center gap-3 rounded-xl border px-4 py-3 text-sm font-semibold transition-all duration-200",
              "border-border bg-background text-foreground",
              "hover:border-[#ffae04]/40 hover:bg-accent",
              "active:scale-[0.98]",
              "disabled:cursor-not-allowed disabled:opacity-50",
            ].join(" ")}
          >
            {isPending ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-border border-t-foreground" />
                Signing in…
              </>
            ) : (
              <>
                <GoogleIcon />
                Continue with Google
              </>
            )}
          </button>

          {/* Error */}
          {authError && (
            <div className="mt-4 rounded-xl border border-destructive/20 bg-destructive/8 px-3 py-2.5 text-xs text-destructive">
              {authError}
            </div>
          )}

          {/* Divider + features */}
          <div className="mt-6 border-t border-border pt-5">
            <ul className="grid gap-2 text-xs text-muted-foreground">
              {[
                "Multi-scenario AI forecasts (conservative → aggressive)",
                "Live market research powered by AI",
                "Your data is private — only you can access it",
              ].map((feat) => (
                <li key={feat} className="flex items-start gap-2">
                  <span className="mt-0.5 text-[#ffae04]">✦</span>
                  {feat}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <p className="mt-5 text-center text-[11px] text-muted-foreground/60">
          By signing in you agree that forecasts are estimates, not financial advice.
        </p>
      </div>
    </div>
  );
}
