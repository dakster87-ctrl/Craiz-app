// ─── Craiz Finance Phase 2 ────────────────────────────────────────────────────
// Shortfall Scaling Engine · Balance Curve Graph · Current Plan Model
// Balance Budget Plan (BBP) · AI Consulting Agent Room
// Project Freeze/Ice System · Floating Widget Framework

import { useState, useEffect, useRef, useMemo, useCallback } from "react";

// ─── Shared helpers ───────────────────────────────────────────────────────────
const fmt$ = (n) => `$${Math.abs(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const uid  = () => (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2, 9));
const LS   = { get: (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } }, set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} } };

const MONTH_LABELS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

async function callFinanceAI(messages, system) {
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 2000, system, messages }),
    });
    const d = await r.json();
    return d.content?.map(b => b.text || "").join("") || "";
  } catch { return ""; }
}

// ─── SHORTFALL SCALING ENGINE ─────────────────────────────────────────────────
export function computeShortfallScales(transactions) {
  const now = new Date();

  const windowSlice = (startFn, endFn) => {
    const s = startFn(), e = endFn();
    const txs = transactions.filter(t => { const d = new Date(t.date); return d >= s && d <= e; });
    const income   = txs.filter(t => t.type === "income").reduce((a, t) => a + t.amount, 0);
    const expenses = txs.filter(t => t.type === "expense").reduce((a, t) => a + t.amount, 0);
    return { income, expenses, net: income - expenses, days: Math.round((e - s) / 86400000) + 1 };
  };

  const weekStart  = (offset = 0) => { const d = new Date(); d.setDate(d.getDate() - d.getDay() - offset * 7); d.setHours(0,0,0,0); return d; };
  const weekEnd    = (offset = 0) => { const d = weekStart(offset); d.setDate(d.getDate() + 6); d.setHours(23,59,59,999); return d; };
  const monthStart = (offset = 0) => { const d = new Date(); d.setMonth(d.getMonth() - offset); d.setDate(1); d.setHours(0,0,0,0); return d; };
  const monthEnd   = (offset = 0) => { const d = new Date(); d.setMonth(d.getMonth() - offset + 1); d.setDate(0); d.setHours(23,59,59,999); return d; };

  const thisWeek    = windowSlice(() => weekStart(0),  () => new Date());
  const lastWeek    = windowSlice(() => weekStart(1),  () => weekEnd(1));
  const last3Weeks  = windowSlice(() => weekStart(3),  () => new Date());
  const thisMonth   = windowSlice(() => monthStart(0), () => new Date());
  const lastMonth   = windowSlice(() => monthStart(1), () => monthEnd(1));
  const last3Months = windowSlice(() => monthStart(3), () => monthEnd(0));
  const last6Months = windowSlice(() => monthStart(6), () => monthEnd(0));

  // Week-over-week velocity
  const weekVelocity = thisWeek.expenses - lastWeek.expenses;

  // Monthly burn rate trend — last 6 months broken out
  const monthlyHistory = Array.from({ length: 6 }, (_, i) => {
    const mo = windowSlice(() => monthStart(5 - i), () => monthEnd(5 - i));
    const d = new Date(); d.setMonth(d.getMonth() - (5 - i));
    return { label: MONTH_LABELS[d.getMonth()], ...mo };
  });

  // Compute linear regression on monthly expenses to get trend slope
  const n = monthlyHistory.length;
  const xs = monthlyHistory.map((_, i) => i);
  const ys = monthlyHistory.map(m => m.expenses);
  const xMean = xs.reduce((a, v) => a + v, 0) / n;
  const yMean = ys.reduce((a, v) => a + v, 0) / n;
  const slope = xs.reduce((a, x, i) => a + (x - xMean) * (ys[i] - yMean), 0) /
                (xs.reduce((a, x) => a + (x - xMean) ** 2, 0) || 1);
  const intercept = yMean - slope * xMean;

  // Project 6 months forward
  const projected = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(); d.setMonth(d.getMonth() + i + 1);
    const projExpense = Math.max(0, intercept + slope * (n + i));
    const projIncome  = last6Months.income / 6; // assume flat income
    return {
      label: MONTH_LABELS[d.getMonth()],
      projectedExpense: projExpense,
      projectedIncome:  projIncome,
      projectedNet:     projIncome - projExpense,
      isShortfall:      projIncome < projExpense,
    };
  });

  const shortfallMonths = projected.filter(p => p.isShortfall).length;
  const firstShortfall  = projected.find(p => p.isShortfall);
  const avgMonthlyIncome = last6Months.income / 6;
  const avgMonthlyExpense = last6Months.expenses / 6;

  return {
    thisWeek, lastWeek, last3Weeks,
    thisMonth, lastMonth, last3Months, last6Months,
    weekVelocity, monthlyHistory, projected,
    slope, shortfallMonths, firstShortfall,
    avgMonthlyIncome, avgMonthlyExpense,
    trendDirection: slope > 50 ? "accelerating" : slope > 0 ? "rising" : slope < -50 ? "improving fast" : "stable",
  };
}

// ─── SVG BALANCE CURVE CHART ──────────────────────────────────────────────────
function BalanceCurveChart({ scales, adjustments, onAdjustmentChange, showControls = true }) {
  const svgRef    = useRef(null);
  const W = 700, H = 320, PAD = { top: 20, right: 20, bottom: 40, left: 64 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top  - PAD.bottom;

  const { monthlyHistory, projected } = scales;

  // Combined data: 6 historical + 6 projected
  const historical = monthlyHistory.map((m, i) => ({
    i, label: m.label, net: m.net, isProjected: false,
  }));
  const future = projected.map((p, i) => ({
    i: monthlyHistory.length + i,
    label: p.label,
    net: p.projectedNet + (adjustments[i] || 0),
    isProjected: true,
    isShortfall: p.isShortfall,
  }));
  const all = [...historical, ...future];

  const allNets = all.map(p => p.net);
  const minNet  = Math.min(...allNets, -500);
  const maxNet  = Math.max(...allNets,  500);
  const range   = maxNet - minNet || 1;

  const toX = (i) => PAD.left + (i / (all.length - 1)) * innerW;
  const toY = (v) => PAD.top  + (1 - (v - minNet) / range) * innerH;
  const zeroY = toY(0);

  // Build SVG path
  const histPath = historical.map((p, i) => `${i === 0 ? "M" : "L"}${toX(p.i)},${toY(p.net)}`).join(" ");
  const futurePath = [
    `M${toX(historical[historical.length - 1].i)},${toY(historical[historical.length - 1].net)}`,
    ...future.map(p => `L${toX(p.i)},${toY(p.net)}`),
  ].join(" ");

  const [dragging, setDragging] = useState(null);

  const handleMouseDown = (futureIdx) => (e) => {
    e.preventDefault();
    setDragging(futureIdx);
  };

  const handleMouseMove = useCallback((e) => {
    if (dragging === null || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const svgY  = ((e.clientY - rect.top) / rect.height) * H;
    const rawVal = minNet + (1 - (svgY - PAD.top) / innerH) * range;
    const original = projected[dragging].projectedNet;
    const newAdj   = Math.round((rawVal - original) / 10) * 10;
    onAdjustmentChange(dragging, newAdj);
  }, [dragging, minNet, range, projected]);

  const handleMouseUp = useCallback(() => setDragging(null), []);

  useEffect(() => {
    if (dragging !== null) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup",   handleMouseUp);
      return () => { window.removeEventListener("mousemove", handleMouseMove); window.removeEventListener("mouseup", handleMouseUp); };
    }
  }, [dragging, handleMouseMove, handleMouseUp]);

  // Y-axis labels
  const yTicks = Array.from({ length: 5 }, (_, i) => minNet + (range / 4) * i);

  return (
    <div style={{ overflowX: "auto" }}>
      <svg ref={svgRef} width={W} height={H} style={{ display: "block", cursor: dragging !== null ? "ns-resize" : "default" }}>
        {/* Grid lines */}
        {yTicks.map((v, i) => (
          <g key={i}>
            <line x1={PAD.left} y1={toY(v)} x2={W - PAD.right} y2={toY(v)} stroke="rgba(255,255,255,0.05)" strokeWidth={1} />
            <text x={PAD.left - 6} y={toY(v) + 4} textAnchor="end" fill="#64748b" fontSize={11} fontFamily="Space Mono, monospace">
              {v >= 0 ? "+" : ""}{Math.round(v / 100) * 100 >= 1000 ? `${Math.round(v / 1000)}k` : Math.round(v)}
            </text>
          </g>
        ))}

        {/* Zero line */}
        {minNet < 0 && maxNet > 0 && (
          <line x1={PAD.left} y1={zeroY} x2={W - PAD.right} y2={zeroY} stroke="rgba(255,255,255,0.15)" strokeWidth={1} strokeDasharray="4,4" />
        )}

        {/* Shortfall fill zones */}
        {future.filter(p => p.isShortfall).map(p => (
          <rect key={p.i} x={toX(p.i) - (innerW / (all.length - 1)) / 2} y={PAD.top} width={innerW / (all.length - 1)} height={innerH} fill="rgba(239,68,68,0.04)" />
        ))}

        {/* Divider: historical vs projected */}
        <line x1={toX(historical.length - 1)} y1={PAD.top} x2={toX(historical.length - 1)} y2={H - PAD.bottom} stroke="rgba(245,158,11,0.3)" strokeWidth={1} strokeDasharray="4,4" />
        <text x={toX(historical.length - 1) + 4} y={PAD.top + 14} fill="#f59e0b" fontSize={10} fontFamily="Space Mono, monospace">TODAY</text>

        {/* Historical line */}
        <path d={histPath} fill="none" stroke="#06b6d4" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />

        {/* Projected line */}
        <path d={futurePath} fill="none" stroke="#f59e0b" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" strokeDasharray="6,3" />

        {/* X-axis labels */}
        {all.map((p, i) => (
          <text key={i} x={toX(p.i)} y={H - PAD.bottom + 18} textAnchor="middle" fill="#64748b" fontSize={10} fontFamily="Space Mono, monospace">
            {p.label}
          </text>
        ))}

        {/* Data points */}
        {historical.map(p => (
          <circle key={p.i} cx={toX(p.i)} cy={toY(p.net)} r={4} fill="#06b6d4" stroke="#0c0f14" strokeWidth={2} />
        ))}

        {/* Draggable projected points */}
        {showControls && future.map((p, fi) => (
          <g key={p.i}>
            <circle cx={toX(p.i)} cy={toY(p.net)} r={7} fill={p.isShortfall ? "#ef4444" : "#f59e0b"} stroke="#0c0f14" strokeWidth={2}
              style={{ cursor: "ns-resize" }} onMouseDown={handleMouseDown(fi)} />
            {p.net < 0 && (
              <text x={toX(p.i)} y={toY(p.net) - 12} textAnchor="middle" fill="#ef4444" fontSize={9} fontFamily="Space Mono, monospace">
                {fmt$(p.net)}
              </text>
            )}
          </g>
        ))}

        {/* Legend */}
        <g transform={`translate(${PAD.left}, ${H - 8})`}>
          <line x1={0} y1={0} x2={20} y2={0} stroke="#06b6d4" strokeWidth={2.5} />
          <text x={24} y={4} fill="#64748b" fontSize={10} fontFamily="Space Mono, monospace">Historical</text>
          <line x1={90} y1={0} x2={110} y2={0} stroke="#f59e0b" strokeWidth={2.5} strokeDasharray="5,3" />
          <text x={114} y={4} fill="#64748b" fontSize={10} fontFamily="Space Mono, monospace">Projected (drag to adjust)</text>
        </g>
      </svg>
    </div>
  );
}

// ─── BALANCE BUDGET PLAN MODAL ────────────────────────────────────────────────
function BBPModal({ scales, onApprove, onDeny, onClose }) {
  const [plan, setPlan]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [decision, setDecision] = useState(null); // null | "approved" | "denied"

  useEffect(() => { generatePlan(); }, []);

  const generatePlan = async () => {
    setLoading(true);
    const { shortfallMonths, firstShortfall, avgMonthlyIncome, avgMonthlyExpense, slope, projected } = scales;
    const prompt = `A user needs a Balance Budget Plan. Analyze their finances and generate a specific, actionable plan.

Data:
- Avg monthly income: $${avgMonthlyIncome.toFixed(2)}
- Avg monthly expenses: $${avgMonthlyExpense.toFixed(2)}
- Monthly expense trend: ${slope > 0 ? "increasing" : "decreasing"} by $${Math.abs(slope).toFixed(2)}/month
- Projected shortfall months: ${shortfallMonths} of next 6
- First shortfall: ${firstShortfall ? `$${Math.abs(firstShortfall.projectedNet).toFixed(2)} in ${firstShortfall.label}` : "None projected"}

Projected months: ${projected.map(p => `${p.label}: $${p.projectedNet.toFixed(2)}`).join(", ")}

Return ONLY a JSON object with:
{
  "summary": "2-sentence plain English summary of the financial situation",
  "severity": "critical|warning|stable",
  "monthlyTarget": number (ideal monthly expense target),
  "savingsTarget": number (monthly savings goal),
  "immediateActions": ["action1", "action2", "action3"] (specific dollar-amount actions for this month),
  "reductions": [{ "category": string, "current": number, "target": number, "saving": number }],
  "timeline": "e.g. If implemented now, you'll be back to positive cash flow by March",
  "riskIfIgnored": "Specific consequence of not acting"
}`;

    const text = await callFinanceAI([{ role: "user", content: prompt }],
      "You are a financial advisor AI inside Craiz. Return only valid JSON. Be specific with dollar amounts.");
    try {
      const clean = text.replace(/```json|```/g, "").trim();
      setPlan(JSON.parse(clean));
    } catch { setPlan(null); }
    setLoading(false);
  };

  const sev = { critical: { color: "#ef4444", bg: "rgba(239,68,68,0.08)", label: "Critical" }, warning: { color: "#f97316", bg: "rgba(249,115,22,0.08)", label: "Warning" }, stable: { color: "#22c55e", bg: "rgba(34,197,94,0.08)", label: "Stable" } };
  const s = plan ? (sev[plan.severity] || sev.warning) : sev.warning;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: 600, maxHeight: "85vh", overflowY: "auto" }}>
        <div className="modal-header">
          <div className="modal-title">📋 Balance Budget Plan</div>
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>
        <div style={{ padding: "0 24px 24px" }}>
          {loading && <div style={{ textAlign: "center", padding: "40px 0", color: "var(--accent)", fontFamily: "Space Mono, monospace", fontSize: 13 }}>Generating your personalized plan...</div>}

          {!loading && !plan && <div style={{ color: "#ef4444", textAlign: "center", padding: "20px 0" }}>Could not generate plan. Please try again.</div>}

          {!loading && plan && decision === null && (
            <>
              <div style={{ background: s.bg, border: `1px solid ${s.color}30`, borderRadius: 10, padding: "14px 16px", marginBottom: 20 }}>
                <div style={{ fontSize: 12, color: s.color, fontFamily: "Space Mono, monospace", letterSpacing: 2, textTransform: "uppercase", marginBottom: 6 }}>{s.label} Financial Situation</div>
                <div style={{ fontSize: 14, lineHeight: 1.7 }}>{plan.summary}</div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
                <div style={{ background: "var(--surface2)", borderRadius: 10, padding: "14px 16px" }}>
                  <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 6 }}>Monthly Expense Target</div>
                  <div style={{ fontSize: 24, fontWeight: 700, fontFamily: "Space Mono, monospace", color: "#f59e0b" }}>{fmt$(plan.monthlyTarget)}</div>
                </div>
                <div style={{ background: "var(--surface2)", borderRadius: 10, padding: "14px 16px" }}>
                  <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 6 }}>Monthly Savings Goal</div>
                  <div style={{ fontSize: 24, fontWeight: 700, fontFamily: "Space Mono, monospace", color: "#22c55e" }}>{fmt$(plan.savingsTarget)}</div>
                </div>
              </div>

              {plan.immediateActions?.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>⚡ Immediate Actions (This Month)</div>
                  {plan.immediateActions.map((a, i) => (
                    <div key={i} style={{ display: "flex", gap: 10, padding: "8px 0", borderBottom: "1px solid var(--border)", fontSize: 13 }}>
                      <span style={{ color: "#f59e0b", fontWeight: 700, flexShrink: 0 }}>{i + 1}.</span>
                      <span>{a}</span>
                    </div>
                  ))}
                </div>
              )}

              {plan.reductions?.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>✂️ Suggested Reductions</div>
                  {plan.reductions.map((r, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
                      <span style={{ fontSize: 13 }}>{r.category}</span>
                      <div style={{ display: "flex", gap: 12, alignItems: "center", fontSize: 12, fontFamily: "Space Mono, monospace" }}>
                        <span style={{ color: "var(--muted)", textDecoration: "line-through" }}>{fmt$(r.current)}</span>
                        <span style={{ color: "#22c55e" }}>→ {fmt$(r.target)}</span>
                        <span style={{ color: "#f59e0b" }}>save {fmt$(r.saving)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ background: "rgba(6,182,212,0.08)", border: "1px solid rgba(6,182,212,0.2)", borderRadius: 10, padding: "12px 16px", marginBottom: 20 }}>
                <div style={{ fontSize: 12, color: "#06b6d4", marginBottom: 4 }}>📅 {plan.timeline}</div>
                {plan.riskIfIgnored && <div style={{ fontSize: 12, color: "#ef4444", marginTop: 6 }}>⚠️ If ignored: {plan.riskIfIgnored}</div>}
              </div>

              <div style={{ display: "flex", gap: 12 }}>
                <button onClick={() => { setDecision("denied"); onDeny && onDeny(plan); }} className="btn-ghost" style={{ flex: 1, textAlign: "center", color: "#ef4444", borderColor: "rgba(239,68,68,0.3)" }}>
                  ✕ Deny This Plan
                </button>
                <button onClick={() => { setDecision("approved"); onApprove && onApprove(plan); }} className="btn-primary" style={{ flex: 1, textAlign: "center" }}>
                  ✓ Approve This Plan
                </button>
              </div>
            </>
          )}

          {decision === "approved" && (
            <div style={{ textAlign: "center", padding: "32px 0" }}>
              <div style={{ fontSize: 40, marginBottom: 16 }}>✅</div>
              <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Plan Approved</div>
              <div style={{ fontSize: 14, color: "var(--muted)", marginBottom: 24 }}>Your Balance Budget Plan is now active and visible in the Current Plan Model. The AI will track your progress against it.</div>
              <button className="btn-primary" onClick={onClose}>Go to Current Plan Model</button>
            </div>
          )}

          {decision === "denied" && (
            <div style={{ textAlign: "center", padding: "32px 0" }}>
              <div style={{ fontSize: 40, marginBottom: 16 }}>✗</div>
              <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Plan Declined</div>
              <div style={{ fontSize: 14, color: "var(--muted)", marginBottom: 24 }}>No changes made. You can generate a new plan anytime or adjust the balance curve manually in the Current Plan Model.</div>
              <button className="btn-ghost" onClick={onClose}>Close</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── CONSULTING AGENT ROOM ────────────────────────────────────────────────────
export function ConsultingAgentRoom({ scales, activePlan, transactions, budgetLimits, projects, onClose }) {
  const [msgs, setMsgs] = useState([
    { from: "system", text: "Welcome to the Craiz Financial Consulting Room. You're speaking with two specialized agents: the **Finance Analyst** (reads your full spending data and trends) and the **Strategy Advisor** (focuses on goals, projects, and long-term planning). They can discuss with each other to give you better answers. What would you like to explore?" }
  ]);
  const [input, setInput]     = useState("");
  const [loading, setLoading] = useState(false);
  const [agentTurn, setAgentTurn] = useState(null); // "analyst" | "advisor" | null
  const endRef = useRef(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs]);

  const contextBlock = () => {
    const { avgMonthlyIncome, avgMonthlyExpense, shortfallMonths, trendDirection, projected } = scales;
    return `
FINANCIAL CONTEXT:
Avg monthly income: $${avgMonthlyIncome?.toFixed(2)}
Avg monthly expenses: $${avgMonthlyExpense?.toFixed(2)}
Monthly net: $${(avgMonthlyIncome - avgMonthlyExpense)?.toFixed(2)}
Spending trend: ${trendDirection}
Projected shortfall months (next 6): ${shortfallMonths}
Projected: ${projected?.map(p => `${p.label}: $${p.projectedNet?.toFixed(2)}`).join(", ")}
Active BBP: ${activePlan ? "Yes — target $" + activePlan.monthlyTarget?.toFixed(2) + "/month" : "None"}
Active projects: ${projects?.map(p => p.name).join(", ") || "None"}
Recent transactions: ${transactions?.slice(-5).map(t => `${t.description} $${t.amount}`).join(", ") || "None"}`;
  };

  const send = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput("");
    setMsgs(m => [...m, { from: "user", text: userMsg }]);
    setLoading(true);

    const history = msgs.filter(m => m.from !== "system").map(m => ({
      role: m.from === "user" ? "user" : "assistant",
      content: m.text,
    }));

    // Step 1: Finance Analyst responds
    setAgentTurn("analyst");
    const analystSystem = `You are the Finance Analyst agent inside Craiz's Financial Consulting Room. You have deep knowledge of the user's spending data, trends, and projections. Speak in first person as "Finance Analyst". Be specific with numbers. Keep response under 150 words. After your analysis, end with one question or handoff to the Strategy Advisor if relevant.\n${contextBlock()}`;

    const analystReply = await callFinanceAI(
      [...history, { role: "user", content: userMsg }],
      analystSystem
    );
    setMsgs(m => [...m, { from: "analyst", text: analystReply }]);

    // Step 2: Strategy Advisor builds on the analyst's take
    setAgentTurn("advisor");
    const advisorSystem = `You are the Strategy Advisor agent inside Craiz's Financial Consulting Room. You focus on goals, projects, and long-term financial strategy. Speak in first person as "Strategy Advisor". The Finance Analyst just responded — build on their analysis, add strategic perspective, and give the user 2-3 concrete next steps. Keep under 150 words.\n${contextBlock()}`;

    const advisorReply = await callFinanceAI(
      [...history, { role: "user", content: userMsg }, { role: "assistant", content: `Finance Analyst: ${analystReply}` }],
      advisorSystem
    );
    setMsgs(m => [...m, { from: "advisor", text: advisorReply }]);

    setAgentTurn(null);
    setLoading(false);
  };

  const fromConfig = {
    system:  { label: "System",           color: "var(--muted)",  bg: "rgba(255,255,255,0.03)", icon: "◈" },
    user:    { label: "You",              color: "var(--accent)", bg: "rgba(245,158,11,0.08)",  icon: "▶" },
    analyst: { label: "Finance Analyst",  color: "#06b6d4",       bg: "rgba(6,182,212,0.08)",   icon: "📊" },
    advisor: { label: "Strategy Advisor", color: "#a78bfa",       bg: "rgba(167,139,250,0.08)", icon: "🎯" },
  };

  const PROMPTS = [
    "What's my biggest financial risk right now?",
    "Which project should I consider freezing to save money?",
    "How should I adjust my budget to reach my goals faster?",
    "What's the domino effect if I miss next month's income target?",
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "var(--surface)", borderRadius: 16, border: "1px solid var(--border)", overflow: "hidden" }}>
      {/* Header */}
      <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--surface2)" }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700 }}>💼 Financial Consulting Room</div>
          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
            <span style={{ color: "#06b6d4" }}>📊 Finance Analyst</span> & <span style={{ color: "#a78bfa" }}>🎯 Strategy Advisor</span> — both active
          </div>
        </div>
        {onClose && <button className="btn-icon" onClick={onClose}>✕</button>}
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
        {msgs.map((m, i) => {
          const cfg = fromConfig[m.from];
          return (
            <div key={i} style={{ background: cfg.bg, border: `1px solid ${cfg.color}20`, borderLeft: `3px solid ${cfg.color}`, borderRadius: "0 10px 10px 0", padding: "12px 14px" }}>
              <div style={{ fontSize: 10, color: cfg.color, fontFamily: "Space Mono, monospace", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 6 }}>
                {cfg.icon} {cfg.label}
              </div>
              <div style={{ fontSize: 13, lineHeight: 1.7, color: "var(--text)", whiteSpace: "pre-wrap" }}>{m.text}</div>
            </div>
          );
        })}

        {loading && (
          <div style={{ background: "rgba(255,255,255,0.02)", borderRadius: 10, padding: "12px 14px" }}>
            <div style={{ fontSize: 10, color: agentTurn === "analyst" ? "#06b6d4" : "#a78bfa", fontFamily: "Space Mono, monospace", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 6 }}>
              {agentTurn === "analyst" ? "📊 Finance Analyst" : "🎯 Strategy Advisor"} thinking...
            </div>
            <div style={{ display: "flex", gap: 4 }}>
              {[0,1,2].map(i => <div key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--muted)", animation: `pulse 1s ${i * 0.2}s infinite` }} />)}
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Quick prompts */}
      {msgs.length <= 1 && (
        <div style={{ padding: "0 20px 12px", display: "flex", gap: 8, flexWrap: "wrap" }}>
          {PROMPTS.map(p => (
            <button key={p} onClick={() => setInput(p)}
              style={{ fontSize: 11, padding: "5px 10px", borderRadius: 16, background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--muted)", cursor: "pointer", fontFamily: "DM Sans, sans-serif" }}>
              {p}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div style={{ padding: "12px 20px", borderTop: "1px solid var(--border)", display: "flex", gap: 10 }}>
        <input value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && send()}
          placeholder="Ask the agents anything about your finances..."
          style={{ flex: 1, background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "var(--text)", fontFamily: "DM Sans, sans-serif", outline: "none" }} />
        <button className="btn-primary" onClick={send} disabled={loading} style={{ padding: "10px 16px" }}>↑</button>
      </div>
    </div>
  );
}

// ─── CURRENT PLAN MODEL PAGE ──────────────────────────────────────────────────
export function CurrentPlanModel({ transactions, budgetLimits, projects, tasks }) {
  const scales = useMemo(() => computeShortfallScales(transactions), [transactions]);
  const [adjustments, setAdjustments] = useState(() => LS.get("craiz_curve_adj", Array(6).fill(0)));
  const [activePlan, setActivePlan]   = useState(() => LS.get("craiz_active_bbp", null));
  const [showBBP, setShowBBP]         = useState(false);
  const [showConsulting, setShowConsulting] = useState(false);
  const [userCurveNote, setUserCurveNote] = useState("");

  useEffect(() => { LS.set("craiz_curve_adj", adjustments); }, [adjustments]);

  const handleAdjustment = (idx, val) => {
    setAdjustments(prev => { const next = [...prev]; next[idx] = val; return next; });
  };

  const resetAdjustments = () => setAdjustments(Array(6).fill(0));

  const { shortfallMonths, firstShortfall, avgMonthlyIncome, avgMonthlyExpense, trendDirection, weekVelocity } = scales;

  // Shortfall comparison table data
  const compTable = [
    { label: "This Week",     ...scales.thisWeek,    vs: scales.lastWeek,    vsLabel: "Last Week" },
    { label: "Last 3 Weeks",  ...scales.last3Weeks,  vs: null,               vsLabel: null },
    { label: "This Month",    ...scales.thisMonth,   vs: scales.lastMonth,   vsLabel: "Last Month" },
    { label: "Last 3 Months", ...scales.last3Months, vs: null,               vsLabel: null },
    { label: "Last 6 Months", ...scales.last6Months, vs: null,               vsLabel: null },
  ];

  return (
    <div className="view">
      <div className="view-header">
        <div>
          <div className="view-title">📈 Current Plan Model</div>
          <div className="view-sub">Balance curve · Shortfall analysis · Adjusted trajectory</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn-sm" onClick={resetAdjustments}>Reset Curve</button>
          <button className="btn-sm" onClick={() => setShowBBP(true)}>
            {activePlan ? "↻ Update BBP" : "📋 Generate BBP"}
          </button>
          <button className="btn-primary" onClick={() => setShowConsulting(true)}>💼 Consult Agents</button>
        </div>
      </div>

      {/* Status bar */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 14, marginBottom: 24 }}>
        {[
          { label: "Monthly Income Avg",  val: fmt$(avgMonthlyIncome),  color: "#22c55e" },
          { label: "Monthly Expense Avg", val: fmt$(avgMonthlyExpense), color: "#ef4444" },
          { label: "Spending Trend",       val: trendDirection,           color: weekVelocity > 0 ? "#f97316" : "#22c55e" },
          { label: "Shortfall Months",    val: `${shortfallMonths} of 6`, color: shortfallMonths > 2 ? "#ef4444" : shortfallMonths > 0 ? "#f97316" : "#22c55e" },
        ].map(s => (
          <div key={s.label} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "14px 16px" }}>
            <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 2, color: "var(--muted)", fontFamily: "Space Mono, monospace", marginBottom: 6 }}>{s.label}</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: s.color, fontFamily: "Space Mono, monospace" }}>{s.val}</div>
          </div>
        ))}
      </div>

      {/* Active BBP banner */}
      {activePlan && (
        <div style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 12, padding: "12px 18px", marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 12, color: "#22c55e", fontFamily: "Space Mono, monospace", letterSpacing: 2, textTransform: "uppercase", marginBottom: 4 }}>✓ Active Balance Budget Plan</div>
            <div style={{ fontSize: 13 }}>Target: <strong style={{ color: "#22c55e" }}>{fmt$(activePlan.monthlyTarget)}/month</strong> · Savings goal: <strong style={{ color: "#22c55e" }}>{fmt$(activePlan.savingsTarget)}/month</strong></div>
          </div>
          <button className="btn-sm danger" onClick={() => { setActivePlan(null); LS.set("craiz_active_bbp", null); }}>Revoke</button>
        </div>
      )}

      {/* Balance Curve */}
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: 24, marginBottom: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Balance Curve</div>
            <div style={{ fontSize: 12, color: "var(--muted)" }}>Drag the amber dots to adjust your projected trajectory. The curve updates in real time.</div>
          </div>
          {firstShortfall && (
            <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8, padding: "8px 12px", textAlign: "right" }}>
              <div style={{ fontSize: 10, color: "#ef4444", fontFamily: "Space Mono, monospace", letterSpacing: 1.5, textTransform: "uppercase" }}>First Shortfall</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#ef4444" }}>{firstShortfall.label} — {fmt$(Math.abs(firstShortfall.projectedNet))}</div>
            </div>
          )}
        </div>
        <BalanceCurveChart scales={scales} adjustments={adjustments} onAdjustmentChange={handleAdjustment} />

        {/* Adjustment summary */}
        {adjustments.some(a => a !== 0) && (
          <div style={{ marginTop: 16, padding: "12px 16px", background: "rgba(245,158,11,0.06)", borderRadius: 10, border: "1px solid rgba(245,158,11,0.15)" }}>
            <div style={{ fontSize: 12, color: "var(--accent)", fontFamily: "Space Mono, monospace", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 8 }}>Your Manual Adjustments</div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              {scales.projected.map((p, i) => adjustments[i] !== 0 && (
                <span key={i} style={{ fontSize: 12, fontFamily: "Space Mono, monospace", color: adjustments[i] > 0 ? "#22c55e" : "#ef4444" }}>
                  {p.label}: {adjustments[i] > 0 ? "+" : ""}{fmt$(adjustments[i])}
                </span>
              ))}
            </div>
            <input value={userCurveNote} onChange={e => setUserCurveNote(e.target.value)}
              placeholder="Add a note about why you adjusted this curve..."
              style={{ marginTop: 10, width: "100%", background: "transparent", border: "none", borderBottom: "1px solid var(--border)", padding: "6px 0", fontSize: 12, color: "var(--text)", fontFamily: "DM Sans, sans-serif", outline: "none" }} />
          </div>
        )}
      </div>

      {/* Shortfall Scale Table */}
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: 24, marginBottom: 24 }}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>📊 Shortfall Scaling Analysis</div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                {["Period", "Income", "Expenses", "Net", "vs Previous", "Δ Net"].map(h => (
                  <th key={h} style={{ padding: "8px 12px", textAlign: "left", fontSize: 10, textTransform: "uppercase", letterSpacing: 1.5, color: "var(--muted)", fontFamily: "Space Mono, monospace", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {compTable.map((row, i) => {
                const delta = row.vs ? row.net - row.vs.net : null;
                return (
                  <tr key={i} style={{ borderBottom: "1px solid var(--border)", transition: "background 0.15s" }}
                    onMouseOver={e => e.currentTarget.style.background = "rgba(255,255,255,0.02)"}
                    onMouseOut={e => e.currentTarget.style.background = "transparent"}>
                    <td style={{ padding: "12px", fontWeight: 600 }}>{row.label}</td>
                    <td style={{ padding: "12px", fontFamily: "Space Mono, monospace", color: "#22c55e" }}>{fmt$(row.income)}</td>
                    <td style={{ padding: "12px", fontFamily: "Space Mono, monospace", color: "#ef4444" }}>{fmt$(row.expenses)}</td>
                    <td style={{ padding: "12px", fontFamily: "Space Mono, monospace", fontWeight: 700, color: row.net >= 0 ? "#22c55e" : "#ef4444" }}>{row.net >= 0 ? "+" : ""}{fmt$(row.net)}</td>
                    <td style={{ padding: "12px", color: "var(--muted)", fontSize: 11 }}>{row.vsLabel || "—"}</td>
                    <td style={{ padding: "12px", fontFamily: "Space Mono, monospace", color: delta === null ? "var(--muted)" : delta >= 0 ? "#22c55e" : "#ef4444" }}>
                      {delta === null ? "—" : `${delta >= 0 ? "+" : ""}${fmt$(delta)}`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Monthly history bars */}
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: 24, marginBottom: 24 }}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>📅 6-Month Expense History</div>
        <div style={{ display: "flex", gap: 8, alignItems: "flex-end", height: 120 }}>
          {scales.monthlyHistory.map((m, i) => {
            const maxExp = Math.max(...scales.monthlyHistory.map(x => x.expenses), 1);
            const h = Math.round((m.expenses / maxExp) * 100);
            const isOver = m.expenses > m.income;
            return (
              <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                <div style={{ fontSize: 10, color: isOver ? "#ef4444" : "var(--muted)", fontFamily: "Space Mono, monospace" }}>{fmt$(m.expenses)}</div>
                <div style={{ width: "100%", height: `${h}%`, background: isOver ? "rgba(239,68,68,0.5)" : "rgba(245,158,11,0.4)", borderRadius: "4px 4px 0 0", border: `1px solid ${isOver ? "#ef4444" : "#f59e0b"}`, transition: "height 0.4s" }} />
                <div style={{ fontSize: 10, color: "var(--muted)", fontFamily: "Space Mono, monospace" }}>{m.label}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Consulting quick-launch */}
      {!showConsulting && (
        <div style={{ background: "linear-gradient(135deg, rgba(6,182,212,0.08), rgba(167,139,250,0.08))", border: "1px solid rgba(167,139,250,0.2)", borderRadius: 16, padding: 24, textAlign: "center" }}>
          <div style={{ fontSize: 20, marginBottom: 8 }}>💼</div>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>Need a second opinion?</div>
          <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 16 }}>Open the Consulting Room to talk with the Finance Analyst and Strategy Advisor about your plan, risks, and opportunities.</div>
          <button className="btn-primary" onClick={() => setShowConsulting(true)}>Open Consulting Room</button>
        </div>
      )}

      {showConsulting && (
        <div style={{ height: 560, marginTop: 8 }}>
          <ConsultingAgentRoom scales={scales} activePlan={activePlan} transactions={transactions} budgetLimits={budgetLimits} projects={projects} onClose={() => setShowConsulting(false)} />
        </div>
      )}

      {showBBP && (
        <BBPModal scales={scales}
          onApprove={plan => { setActivePlan(plan); LS.set("craiz_active_bbp", plan); setShowBBP(false); }}
          onDeny={() => setShowBBP(false)}
          onClose={() => setShowBBP(false)} />
      )}
    </div>
  );
}

// ─── PROJECT FREEZE SYSTEM ────────────────────────────────────────────────────
export function FreezeProjectModal({ project, onFreeze, onClose }) {
  const [reason, setReason]   = useState("");
  const [thawDate, setThawDate] = useState(() => { const d = new Date(); d.setMonth(d.getMonth() + 1); return d.toISOString().split("T")[0]; });
  const [note, setNote]       = useState("");

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: 460 }}>
        <div className="modal-header">
          <div className="modal-title">🧊 Freeze Project</div>
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>
        <div style={{ padding: "0 24px 24px" }}>
          <div style={{ background: "rgba(6,182,212,0.08)", border: "1px solid rgba(6,182,212,0.2)", borderRadius: 10, padding: "12px 16px", marginBottom: 20 }}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>{project.name}</div>
            <div style={{ fontSize: 12, color: "var(--muted)" }}>Freezing puts this project on ice. All tasks are preserved — nothing is deleted. You can reactivate it anytime, or the app will remind you on your target date.</div>
          </div>

          <div className="form-group">
            <label className="form-label">Why are you freezing this?</label>
            <select className="form-select" value={reason} onChange={e => setReason(e.target.value)}>
              <option value="">Select a reason...</option>
              <option value="budget">Budget constraints</option>
              <option value="deprioritized">Deprioritized — other things first</option>
              <option value="waiting">Waiting on someone or something</option>
              <option value="rethinking">Rethinking the approach</option>
              <option value="seasonal">Seasonal — not the right time</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Target Reactivation Date</label>
            <input className="form-input" type="date" value={thawDate} onChange={e => setThawDate(e.target.value)} min={new Date().toISOString().split("T")[0]} />
          </div>

          <div className="form-group">
            <label className="form-label">Notes (optional)</label>
            <textarea className="form-textarea" value={note} onChange={e => setNote(e.target.value)} placeholder="Anything to remember when this thaws..." style={{ minHeight: 72 }} />
          </div>

          <div className="modal-actions">
            <button className="btn-ghost" onClick={onClose}>Cancel</button>
            <button className="btn-primary" style={{ background: "#06b6d4" }} onClick={() => reason && onFreeze({ reason, thawDate, note, frozenAt: new Date().toISOString() })}>
              🧊 Freeze Project
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function FrozenProjectsView({ projects, onThaw, onDelete }) {
  const frozen = projects.filter(p => p.frozen);
  if (frozen.length === 0) return null;

  return (
    <div style={{ marginTop: 24, background: "var(--surface)", border: "1px solid rgba(6,182,212,0.2)", borderRadius: 16, padding: 20 }}>
      <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16, color: "#06b6d4" }}>🧊 On Ice ({frozen.length})</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {frozen.map(p => {
          const thawDays = p.frozen?.thawDate ? Math.ceil((new Date(p.frozen.thawDate) - new Date()) / 86400000) : null;
          return (
            <div key={p.id} style={{ background: "rgba(6,182,212,0.05)", border: "1px solid rgba(6,182,212,0.15)", borderRadius: 12, padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>{p.name}</div>
                <div style={{ fontSize: 12, color: "var(--muted)" }}>
                  Frozen: {p.frozen?.reason || "No reason given"}
                  {thawDays !== null && <span style={{ marginLeft: 10, color: thawDays <= 0 ? "#f59e0b" : "#06b6d4" }}>
                    {thawDays <= 0 ? "⏰ Ready to thaw!" : `Thaws in ${thawDays} days`}
                  </span>}
                </div>
                {p.frozen?.note && <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4, fontStyle: "italic" }}>"{p.frozen.note}"</div>}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn-sm" style={{ borderColor: "#06b6d4", color: "#06b6d4" }} onClick={() => onThaw(p.id)}>🌡 Thaw</button>
                <button className="btn-sm danger" onClick={() => onDelete(p.id)}>🗑</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── FLOATING WIDGET FRAMEWORK ────────────────────────────────────────────────
export function FloatingWidget({ id, title, icon, initialPos, onClose, children, width = 340, height = 420 }) {
  const [pos, setPos]       = useState(initialPos || { x: window.innerWidth - width - 24, y: 80 });
  const [size, setSize]     = useState({ width, height });
  const [minimized, setMin] = useState(false);
  const [dragging, setDrag] = useState(false);
  const dragRef             = useRef(null);
  const widgetRef           = useRef(null);

  const startDrag = (e) => {
    dragRef.current = { startX: e.clientX - pos.x, startY: e.clientY - pos.y };
    setDrag(true);
  };

  useEffect(() => {
    if (!dragging) return;
    const move = (e) => setPos({ x: e.clientX - dragRef.current.startX, y: e.clientY - dragRef.current.startY });
    const up   = () => setDrag(false);
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup",   up);
    return () => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); };
  }, [dragging]);

  return (
    <div ref={widgetRef} style={{
      position: "fixed", left: pos.x, top: pos.y, zIndex: 300,
      width: size.width, background: "var(--surface)", border: "1px solid var(--border)",
      borderRadius: 14, boxShadow: "0 16px 48px rgba(0,0,0,0.6)", overflow: "hidden",
      userSelect: dragging ? "none" : "auto",
    }}>
      {/* Drag handle / header */}
      <div onMouseDown={startDrag} style={{
        padding: "10px 14px", background: "var(--surface2)", borderBottom: "1px solid var(--border)",
        display: "flex", alignItems: "center", gap: 8, cursor: dragging ? "grabbing" : "grab",
      }}>
        <span style={{ fontSize: 14 }}>{icon}</span>
        <span style={{ flex: 1, fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</span>
        <button onClick={() => setMin(m => !m)} style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", fontSize: 14, padding: "2px 6px" }}>
          {minimized ? "▢" : "─"}
        </button>
        <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", fontSize: 14, padding: "2px 6px" }}>✕</button>
      </div>
      {!minimized && (
        <div style={{ height: size.height, overflowY: "auto" }}>
          {children}
        </div>
      )}
    </div>
  );
}

// Widget launcher button — attach to any view
export function WidgetLauncher({ widgets, onLaunch }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <button className="btn-sm" onClick={() => setOpen(o => !o)} title="Open as floating widget">
        ⊞ Float
      </button>
      {open && (
        <div style={{ position: "absolute", top: "100%", right: 0, zIndex: 200, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 8, minWidth: 200, boxShadow: "0 8px 32px rgba(0,0,0,0.4)", marginTop: 4 }}>
          {widgets.map(w => (
            <button key={w.id} onClick={() => { onLaunch(w); setOpen(false); }}
              style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "9px 12px", background: "none", border: "none", borderRadius: 8, color: "var(--text)", cursor: "pointer", fontSize: 13, fontFamily: "DM Sans, sans-serif", textAlign: "left" }}
              onMouseOver={e => e.currentTarget.style.background = "rgba(255,255,255,0.04)"}
              onMouseOut={e => e.currentTarget.style.background = "none"}>
              <span>{w.icon}</span> {w.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
