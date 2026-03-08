const PAYMENT_LINK = import.meta.env.VITE_STRIPE_PAYMENT_LINK || "#";
const PRICE_MONTHLY = import.meta.env.VITE_PRICE_MONTHLY || "9.99";

export default function Paywall({ user, trialEnded, onSignOut }) {
  const s = {
    overlay: { minHeight:"100vh",background:"#0c0f14",display:"flex",alignItems:"center",justifyContent:"center",padding:"24px",fontFamily:"'DM Sans',sans-serif" },
    card: { background:"#131820",border:"1px solid rgba(245,158,11,0.25)",borderRadius:"20px",padding:"44px 40px",width:"100%",maxWidth:"460px",textAlign:"center" },
    badge: { background:"rgba(245,158,11,0.15)",color:"#f59e0b",fontFamily:"'Space Mono',monospace",fontSize:"10px",letterSpacing:"2px",padding:"4px 12px",borderRadius:"20px",display:"inline-block",marginBottom:"20px" },
    title: { fontSize:"26px",fontWeight:"700",color:"#e2e8f0",marginBottom:"10px" },
    sub: { fontSize:"15px",color:"#64748b",lineHeight:"1.7",marginBottom:"32px" },
    price: { fontFamily:"'Space Mono',monospace",fontSize:"42px",fontWeight:"700",color:"#f59e0b" },
    period: { fontSize:"15px",color:"#64748b",marginBottom:"28px",marginTop:"4px" },
    list: { listStyle:"none",textAlign:"left",marginBottom:"32px",display:"flex",flexDirection:"column",gap:"10px" },
    listItem: { fontSize:"14px",color:"#e2e8f0",display:"flex",gap:"10px",alignItems:"flex-start" },
    check: { color:"#f59e0b",fontWeight:"700",flexShrink:0 },
    btn: { width:"100%",background:"#f59e0b",color:"#000",border:"none",borderRadius:"10px",padding:"14px",fontSize:"15px",fontWeight:"700",cursor:"pointer",textDecoration:"none",display:"block",transition:"background 0.2s",marginBottom:"12px" },
    guarantee: { fontSize:"13px",color:"#475569",marginBottom:"20px" },
    signout: { fontSize:"13px",color:"#475569",cursor:"pointer",marginTop:"4px" },
  };

  return (
    <div style={s.overlay}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=DM+Sans:wght@300;400;500;600&display=swap');`}</style>
      <div style={s.card}>
        <div style={s.badge}>
          {trialEnded ? "TRIAL ENDED" : "UPGRADE REQUIRED"}
        </div>
        <div style={s.title}>
          {trialEnded ? "Your free trial has ended" : "Subscribe to keep going"}
        </div>
        <div style={s.sub}>
          {trialEnded
            ? `Hi ${user?.user_metadata?.full_name?.split(" ")[0] || "there"} — your 7-day free trial is over. Subscribe to keep all your data and unlock full access.`
            : "Get full access to all AI features, unlimited projects, and cross-device sync."}
        </div>
        <div style={s.price}>${PRICE_MONTHLY}</div>
        <div style={s.period}>per month · cancel anytime</div>
        <ul style={s.list}>
          {[
            "Unlimited projects & tasks",
            "AI Daily Briefing & Research assistant",
            "Goal → Task generator with web search",
            "Focus Mode, Burnout Detector, Weekly Retro",
            "Works offline on phone & tablet",
            "All future features included",
          ].map(f => (
            <li key={f} style={s.listItem}>
              <span style={s.check}>✓</span> {f}
            </li>
          ))}
        </ul>
        <a href={`${PAYMENT_LINK}?prefilled_email=${encodeURIComponent(user?.email || "")}`}
           target="_blank" rel="noopener noreferrer"
           style={s.btn}
           onMouseOver={e => e.target.style.background="#fbbf24"}
           onMouseOut={e => e.target.style.background="#f59e0b"}>
          Subscribe Now — ${PRICE_MONTHLY}/month
        </a>
        <div style={s.guarantee}>Secure payment via Stripe · 30-day money-back guarantee</div>
        <div style={s.signout} onClick={onSignOut}>← Sign out</div>
      </div>
    </div>
  );
}
