import { useState } from "react";

const PRICE_MONTHLY = import.meta.env.VITE_PRICE_MONTHLY || "9.99";
const PRICE_YEARLY  = import.meta.env.VITE_PRICE_YEARLY  || "79.99";

export default function Landing({ onGetStarted }) {
  const [billing, setBilling] = useState("monthly");

  const features = [
    { icon: "⚡", title: "AI Importance Scoring", desc: "Projects and tasks auto-ranked by deadline urgency, priority, and workload — so you always know what matters most." },
    { icon: "☀", title: "Daily AI Briefing", desc: "Every morning, a personalized summary of your priorities, risks, and a motivational nudge tailored to your workload." },
    { icon: "🔍", title: "Built-in AI Research", desc: "Ask anything. Get web-searched, summarized answers with suggested tasks added directly to your planner." },
    { icon: "🎯", title: "Goal → Task Generator", desc: "Describe a goal and AI generates a full action plan with deadlines and effort estimates." },
    { icon: "⊕", title: "Focus Mode + Pomodoro", desc: "Distraction-free mode with your top 3 AI-ranked tasks and a built-in timer with AI encouragement between sessions." },
    { icon: "🔥", title: "Burnout Detector", desc: "Monitors your task load and overdue patterns. Warns you before you hit a wall and suggests what to defer." },
    { icon: "📱", title: "Works on Any Device", desc: "Install it on your phone or tablet like a native app. Works offline too — your data is always available." },
    { icon: "◎", title: "Weekly Retrospective", desc: "AI reviews your week: what you crushed, what slipped, patterns in your work, and 3 goals for next week." },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "#0c0f14", color: "#e2e8f0", fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=DM+Sans:wght@300;400;500;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        :root { --accent: #f59e0b; --accent2: #06b6d4; --surface: #131820; --border: rgba(255,255,255,0.07); --muted: #64748b; }
        .landing-nav { display:flex;align-items:center;justify-content:space-between;padding:20px 48px;border-bottom:1px solid var(--border);position:sticky;top:0;background:rgba(12,15,20,0.9);backdrop-filter:blur(12px);z-index:10; }
        .logo-mark { font-family:'Space Mono',monospace;font-size:10px;color:var(--accent);letter-spacing:3px; }
        .logo-name { font-size:16px;font-weight:700;margin-top:2px; }
        .hero { text-align:center;padding:100px 24px 80px;max-width:800px;margin:0 auto; }
        .hero-eyebrow { font-family:'Space Mono',monospace;font-size:11px;color:var(--accent);letter-spacing:3px;text-transform:uppercase;margin-bottom:20px; }
        .hero-title { font-size:clamp(38px,6vw,72px);font-weight:700;line-height:1.05;margin-bottom:20px; }
        .hero-title span { color:var(--accent); }
        .hero-sub { font-size:18px;color:var(--muted);line-height:1.7;max-width:560px;margin:0 auto 36px; }
        .hero-cta { display:flex;gap:12px;justify-content:center;flex-wrap:wrap; }
        .btn-hero { padding:14px 32px;border-radius:10px;font-size:15px;font-weight:600;cursor:pointer;font-family:'DM Sans',sans-serif;transition:all 0.2s; }
        .btn-hero-primary { background:var(--accent);color:#000;border:none; }
        .btn-hero-primary:hover { background:#fbbf24;transform:translateY(-1px);box-shadow:0 8px 24px rgba(245,158,11,0.3); }
        .btn-hero-ghost { background:transparent;color:#e2e8f0;border:1px solid rgba(255,255,255,0.15); }
        .btn-hero-ghost:hover { border-color:rgba(255,255,255,0.3); }
        .section { padding:80px 24px;max-width:1100px;margin:0 auto; }
        .section-label { font-family:'Space Mono',monospace;font-size:10px;letter-spacing:3px;color:var(--accent);text-transform:uppercase;text-align:center;margin-bottom:12px; }
        .section-title { font-size:clamp(24px,4vw,40px);font-weight:700;text-align:center;margin-bottom:48px; }
        .features-grid { display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:20px; }
        .feature-card { background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:24px; }
        .feature-icon { font-size:24px;margin-bottom:12px; }
        .feature-title { font-size:15px;font-weight:600;margin-bottom:8px; }
        .feature-desc { font-size:13px;color:var(--muted);line-height:1.6; }
        .pricing-toggle { display:flex;align-items:center;justify-content:center;gap:12px;margin-bottom:40px; }
        .toggle-option { font-size:14px;cursor:pointer;transition:color 0.15s; }
        .toggle-option.active { color:var(--accent);font-weight:600; }
        .toggle-option.inactive { color:var(--muted); }
        .toggle-track { width:44px;height:24px;background:rgba(245,158,11,0.2);border-radius:12px;border:1px solid rgba(245,158,11,0.3);cursor:pointer;position:relative;transition:background 0.2s; }
        .toggle-thumb { width:18px;height:18px;background:var(--accent);border-radius:50%;position:absolute;top:2px;transition:left 0.2s; }
        .save-badge { background:rgba(34,197,94,0.15);color:#22c55e;font-size:11px;padding:2px 8px;border-radius:10px;font-weight:600; }
        .pricing-card { background:var(--surface);border:1px solid var(--border);border-radius:20px;padding:40px;text-align:center;max-width:420px;margin:0 auto;position:relative;border-color:rgba(245,158,11,0.3); }
        .pricing-card::before { content:'MOST POPULAR';position:absolute;top:-12px;left:50%;transform:translateX(-50%);background:var(--accent);color:#000;font-family:'Space Mono',monospace;font-size:9px;font-weight:700;letter-spacing:2px;padding:4px 12px;border-radius:10px; }
        .price { font-family:'Space Mono',monospace;font-size:52px;font-weight:700;color:var(--accent);line-height:1; }
        .price-period { font-size:16px;color:var(--muted);margin-top:4px;margin-bottom:28px; }
        .price-features { list-style:none;text-align:left;margin-bottom:32px;display:flex;flex-direction:column;gap:10px; }
        .price-features li { font-size:14px;display:flex;align-items:flex-start;gap:8px;color:#e2e8f0; }
        .price-features li::before { content:'✓';color:var(--accent);font-weight:700;flex-shrink:0; }
        .guarantee { text-align:center;color:var(--muted);font-size:13px;margin-top:16px; }
        .social-proof { display:grid;grid-template-columns:repeat(3,1fr);gap:20px;margin-top:48px; }
        .testimonial { background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:20px; }
        .testimonial-text { font-size:14px;line-height:1.7;color:#cbd5e1;margin-bottom:14px;font-style:italic; }
        .testimonial-author { font-size:12px;color:var(--muted);font-weight:600; }
        .footer { border-top:1px solid var(--border);padding:32px 48px;display:flex;align-items:center;justify-content:space-between;color:var(--muted);font-size:13px;flex-wrap:wrap;gap:12px; }
        @media(max-width:768px) { .landing-nav{padding:16px 20px;} .section{padding:60px 20px;} .social-proof{grid-template-columns:1fr;} .hero{padding:60px 20px 60px;} }
      `}</style>

      {/* Nav */}
      <nav className="landing-nav">
        <div>
          <div className="logo-mark">// CRAIZ</div>
          <div className="logo-name">AI Task Planner</div>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <button className="btn-hero btn-hero-ghost" style={{ padding: "8px 20px", fontSize: 13 }} onClick={onGetStarted}>Log In</button>
          <button className="btn-hero btn-hero-primary" style={{ padding: "8px 20px", fontSize: 13 }} onClick={onGetStarted}>Start Free Trial</button>
        </div>
      </nav>

      {/* Hero */}
      <div className="hero">
        <div className="hero-eyebrow">AI-powered productivity</div>
        <h1 className="hero-title">Stop managing tasks.<br /><span>Start accomplishing goals.</span></h1>
        <p className="hero-sub">Craiz uses AI to rank your priorities, research what you need, generate action plans from goals, and keep you motivated — all in one place.</p>
        <div className="hero-cta">
          <button className="btn-hero btn-hero-primary" onClick={onGetStarted}>Start Free Trial — No Credit Card</button>
          <button className="btn-hero btn-hero-ghost" onClick={() => document.getElementById("pricing").scrollIntoView({ behavior: "smooth" })}>See Pricing</button>
        </div>
        <p style={{ marginTop: 16, fontSize: 13, color: "var(--muted)" }}>7-day free trial · Cancel anytime · Works on all devices</p>
      </div>

      {/* Features */}
      <div className="section">
        <div className="section-label">Everything you need</div>
        <h2 className="section-title">Your AI chief of staff, built in</h2>
        <div className="features-grid">
          {features.map(f => (
            <div key={f.title} className="feature-card">
              <div className="feature-icon">{f.icon}</div>
              <div className="feature-title">{f.title}</div>
              <div className="feature-desc">{f.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Testimonials */}
      <div className="section" style={{ paddingTop: 0 }}>
        <div className="section-label">Early users</div>
        <h2 className="section-title">Built for people who ship things</h2>
        <div className="social-proof">
          {[
            { text: "The AI Daily Briefing alone is worth it. I open Craiz before I open email. It tells me exactly what I should be working on and why.", author: "Sarah K. — Freelance Designer" },
            { text: "I described my launch goal and it gave me 9 tasks with deadlines and effort estimates. In 30 seconds. That would have taken me an hour.", author: "Marcus T. — SaaS Founder" },
            { text: "The burnout detector caught me before I crashed. It flagged I was 40% overcommitted and told me which tasks to defer. Actually changed how I plan.", author: "Jordan L. — Product Manager" },
          ].map(t => (
            <div key={t.author} className="testimonial">
              <div className="testimonial-text">"{t.text}"</div>
              <div className="testimonial-author">{t.author}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Pricing */}
      <div className="section" id="pricing">
        <div className="section-label">Simple pricing</div>
        <h2 className="section-title">One plan. Everything included.</h2>

        <div className="pricing-toggle">
          <span className={`toggle-option ${billing === "monthly" ? "active" : "inactive"}`} onClick={() => setBilling("monthly")}>Monthly</span>
          <div className="toggle-track" onClick={() => setBilling(b => b === "monthly" ? "yearly" : "monthly")}>
            <div className="toggle-thumb" style={{ left: billing === "yearly" ? "22px" : "2px" }} />
          </div>
          <span className={`toggle-option ${billing === "yearly" ? "active" : "inactive"}`} onClick={() => setBilling("yearly")}>Yearly</span>
          {billing === "yearly" && <span className="save-badge">Save 33%</span>}
        </div>

        <div className="pricing-card">
          <div className="price">
            ${billing === "monthly" ? PRICE_MONTHLY : PRICE_YEARLY}
          </div>
          <div className="price-period">per {billing === "monthly" ? "month" : "year"}</div>
          <ul className="price-features">
            {[
              "Unlimited projects & tasks",
              "AI Daily Briefing every morning",
              "Web search & AI Research assistant",
              "Goal → Task generator",
              "Focus Mode with Pomodoro timer",
              "Burnout Detector & Risk Radar",
              "Weekly AI Retrospective",
              "Works offline on any device",
              "All future features included",
            ].map(f => <li key={f}>{f}</li>)}
          </ul>
          <button className="btn-hero btn-hero-primary" style={{ width: "100%", justifyContent: "center" }} onClick={onGetStarted}>
            Start 7-Day Free Trial
          </button>
          <div className="guarantee">No credit card required to start. Cancel anytime.</div>
        </div>
      </div>

      {/* Footer */}
      <footer className="footer">
        <div>
          <div className="logo-mark" style={{ marginBottom: 4 }}>// CRAIZ</div>
          <div style={{ fontSize: 12 }}>AI-powered task management</div>
        </div>
        <div style={{ display: "flex", gap: 24 }}>
          <span style={{ cursor: "pointer" }}>Privacy</span>
          <span style={{ cursor: "pointer" }}>Terms</span>
          <span style={{ cursor: "pointer" }}>Support</span>
        </div>
        <div>© {new Date().getFullYear()} Craiz. All rights reserved.</div>
      </footer>
    </div>
  );
}
