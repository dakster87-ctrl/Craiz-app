import { useState } from "react";
import { useAuth } from "./hooks/useAuth";
import { useData } from "./hooks/useData";
import Landing  from "./components/Landing";
import Auth     from "./components/Auth";
import Paywall  from "./components/Paywall";
import Planner  from "./components/Planner";

export default function App() {
  const { user, profile, loading, isSubscribed, isTrialing, signUp, signIn, signOut } = useAuth();
  const [showAuth, setShowAuth] = useState(false);

  const data = useData(user?.id);

  // ── Loading splash ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#0c0f14", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Space Mono, monospace", color: "#f59e0b", fontSize: 12, letterSpacing: 3 }}>
        // CRAIZ
      </div>
    );
  }

  // ── Not logged in ─────────────────────────────────────────────────────────
  if (!user) {
    if (showAuth) return <Auth onBack={() => setShowAuth(false)} signUp={signUp} signIn={signIn} />;
    return <Landing onGetStarted={() => setShowAuth(true)} />;
  }

  // ── Logged in but no active subscription (and trial over) ─────────────────
  const trialEnded = profile && !isSubscribed && !isTrialing;
  if (trialEnded) {
    return <Paywall user={user} trialEnded={true} onSignOut={signOut} />;
  }

  // ── Logged in, subscribed or trialing → show planner ─────────────────────
  return <Planner user={user} profile={profile} isTrialing={isTrialing} onSignOut={signOut} {...data} />;
}
