// ─── Finance Module — Craiz Phase 1 ──────────────────────────────────────────
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { CurrentPlanModel, FreezeProjectModal, FrozenProjectsView, FloatingWidgetV2 } from "./FinancePhase2";
import { WidgetLaunchBar, PlaidConnectionPanel } from "./Phase3";

// ─── Constants ────────────────────────────────────────────────────────────────
const CATEGORIES = [
  { id: "housing",       label: "Housing",       icon: "🏠", color: "#6366f1" },
  { id: "food",          label: "Food",           icon: "🍔", color: "#f59e0b" },
  { id: "transport",     label: "Transport",      icon: "🚗", color: "#06b6d4" },
  { id: "utilities",     label: "Utilities",      icon: "⚡", color: "#8b5cf6" },
  { id: "health",        label: "Health",         icon: "❤️", color: "#ef4444" },
  { id: "subscriptions", label: "Subscriptions",  icon: "📱", color: "#ec4899" },
  { id: "entertainment", label: "Entertainment",  icon: "🎬", color: "#f97316" },
  { id: "savings",       label: "Savings",        icon: "💰", color: "#22c55e" },
  { id: "business",      label: "Business",       icon: "💼", color: "#64748b" },
  { id: "education",     label: "Education",      icon: "📚", color: "#0ea5e9" },
  { id: "personal",      label: "Personal",       icon: "👤", color: "#a78bfa" },
  { id: "other",         label: "Other",          icon: "📦", color: "#94a3b8" },
];

const CAT_MAP = Object.fromEntries(CATEGORIES.map(c => [c.id, c]));
const fmt$ = (n) => `$${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (d) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
const uid = () => crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2, 9);
const startOfMonth = (offset = 0) => { const d = new Date(); d.setMonth(d.getMonth() + offset); d.setDate(1); d.setHours(0,0,0,0); return d; };
const endOfMonth   = (offset = 0) => { const d = new Date(); d.setMonth(d.getMonth() + offset + 1); d.setDate(0); d.setHours(23,59,59,999); return d; };

// ─── Local storage helpers ────────────────────────────────────────────────────
const LS = {
  get:  (k, def) => { try { return JSON.parse(localStorage.getItem(k)) ?? def; } catch { return def; } },
  set:  (k, v)   => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};

// ─── AI helper (inline, self-contained) ──────────────────────────────────────
async function financeAI(prompt, system = "") {
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1200,
        system: system || "You are an expert personal finance AI advisor embedded in a productivity app called Craiz. Be concise, specific, and actionable. Use plain language. Never be alarmist — be clear and helpful.",
        messages: [{ role: "user", content: prompt }],
      }),
    });
    const d = await r.json();
    return d.content?.[0]?.text || "";
  } catch { return ""; }
}

// ─── Trend Engine ─────────────────────────────────────────────────────────────
function buildTrends(transactions) {
  const now = new Date();
  const windows = [
    { label: "This week",    start: (() => { const d = new Date(); d.setDate(d.getDate() - d.getDay()); d.setHours(0,0,0,0); return d; })(), end: new Date() },
    { label: "Last week",    start: (() => { const d = new Date(); d.setDate(d.getDate() - d.getDay() - 7); d.setHours(0,0,0,0); return d; })(), end: (() => { const d = new Date(); d.setDate(d.getDate() - d.getDay() - 1); d.setHours(23,59,59,999); return d; })() },
    { label: "Last 3 weeks", start: (() => { const d = new Date(); d.setDate(d.getDate() - 21); return d; })(), end: new Date() },
    { label: "This month",   start: startOfMonth(0), end: endOfMonth(0) },
    { label: "Last month",   start: startOfMonth(-1), end: endOfMonth(-1) },
    { label: "Last 3 months",start: startOfMonth(-3), end: endOfMonth(0) },
    { label: "Last 6 months",start: startOfMonth(-6), end: endOfMonth(0) },
  ];

  return windows.map(w => {
    const txs = transactions.filter(t => {
      const d = new Date(t.date);
      return d >= w.start && d <= w.end;
    });
    const income   = txs.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);
    const expenses = txs.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0);
    const net      = income - expenses;
    const byCategory = {};
    CATEGORIES.forEach(c => { byCategory[c.id] = txs.filter(t => t.category === c.id && t.type === "expense").reduce((s, t) => s + t.amount, 0); });
    return { ...w, income, expenses, net, byCategory, count: txs.length };
  });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ label, value, sub, color = "var(--accent)", icon }) {
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: "18px 20px", display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {icon && <span style={{ fontSize: 18 }}>{icon}</span>}
        <span style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 2, color: "var(--muted)", fontFamily: "Space Mono, monospace" }}>{label}</span>
      </div>
      <div style={{ fontSize: 26, fontWeight: 700, color, fontFamily: "Space Mono, monospace" }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: "var(--muted)" }}>{sub}</div>}
    </div>
  );
}

function BurndownBar({ label, spent, budget, color }) {
  const pct = budget > 0 ? Math.min((spent / budget) * 100, 100) : 0;
  const over = spent > budget && budget > 0;
  const barColor = pct > 90 ? "#ef4444" : pct > 70 ? "#f97316" : color;
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5, alignItems: "center" }}>
        <span style={{ fontSize: 13, fontWeight: 500 }}>{label}</span>
        <span style={{ fontSize: 12, fontFamily: "Space Mono, monospace", color: over ? "#ef4444" : "var(--muted)" }}>
          {fmt$(spent)} / {fmt$(budget)} {over && "⚠️"}
        </span>
      </div>
      <div style={{ height: 7, background: "var(--surface2)", borderRadius: 4, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: barColor, borderRadius: 4, transition: "width 0.4s" }} />
      </div>
      {over && <div style={{ fontSize: 11, color: "#ef4444", marginTop: 3 }}>Over budget by {fmt$(spent - budget)}</div>}
    </div>
  );
}

function MiniSparkline({ data, color = "var(--accent)" }) {
  if (!data || data.length < 2) return null;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const W = 120, H = 40;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * W;
    const y = H - ((v - min) / range) * H;
    return `${x},${y}`;
  }).join(" ");
  return (
    <svg width={W} height={H} style={{ overflow: "visible" }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={pts.split(" ").pop().split(",")[0]} cy={pts.split(" ").pop().split(",")[1]} r={3} fill={color} />
    </svg>
  );
}

// ─── Transaction Modal ────────────────────────────────────────────────────────
function TransactionModal({ tx, onSave, onClose }) {
  const [form, setForm] = useState({
    type: "expense", amount: "", category: "food", description: "", date: new Date().toISOString().split("T")[0], recurring: false, recurFreq: "monthly", ...tx,
  });
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: 440 }}>
        <div className="modal-header">
          <div className="modal-title">{tx?.id ? "Edit" : "Add"} Transaction</div>
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>
        <div style={{ padding: "0 24px 20px" }}>
          {/* Type toggle */}
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            {["income", "expense"].map(t => (
              <button key={t} onClick={() => setForm(f => ({ ...f, type: t }))}
                style={{ flex: 1, padding: "9px", borderRadius: 8, border: "1px solid var(--border)", background: form.type === t ? (t === "income" ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)") : "transparent", color: form.type === t ? (t === "income" ? "#22c55e" : "#ef4444") : "var(--muted)", cursor: "pointer", fontWeight: 600, fontSize: 13, fontFamily: "DM Sans, sans-serif" }}>
                {t === "income" ? "💰 Income" : "💸 Expense"}
              </button>
            ))}
          </div>

          <div className="form-group">
            <label className="form-label">Amount ($)</label>
            <input className="form-input" type="number" step="0.01" min="0" value={form.amount} onChange={set("amount")} placeholder="0.00" autoFocus />
          </div>
          <div className="form-group">
            <label className="form-label">Description</label>
            <input className="form-input" value={form.description} onChange={set("description")} placeholder="e.g. Grocery run, Monthly rent" />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div className="form-group">
              <label className="form-label">Category</label>
              <select className="form-select" value={form.category} onChange={set("category")}>
                {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Date</label>
              <input className="form-input" type="date" value={form.date} onChange={set("date")} />
            </div>
          </div>

          {/* Recurring */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, padding: "10px 12px", background: "var(--surface2)", borderRadius: 8 }}>
            <input type="checkbox" id="recurring" checked={form.recurring} onChange={e => setForm(f => ({ ...f, recurring: e.target.checked }))} style={{ accentColor: "var(--accent)", width: 16, height: 16 }} />
            <label htmlFor="recurring" style={{ fontSize: 13, cursor: "pointer", flex: 1 }}>Recurring transaction</label>
            {form.recurring && (
              <select className="form-select" style={{ width: "auto", padding: "4px 8px", fontSize: 12 }} value={form.recurFreq} onChange={set("recurFreq")}>
                <option value="weekly">Weekly</option>
                <option value="biweekly">Bi-weekly</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
            )}
          </div>

          <div className="modal-actions">
            <button className="btn-ghost" onClick={onClose}>Cancel</button>
            <button className="btn-primary" onClick={() => form.amount && form.description && onSave({ ...form, id: form.id || uid(), amount: parseFloat(form.amount) })}>
              {tx?.id ? "Save Changes" : "Add Transaction"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Budget Limits Modal ──────────────────────────────────────────────────────
function BudgetLimitsModal({ limits, onSave, onClose }) {
  const [form, setForm] = useState({ ...limits });
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
        <div className="modal-header">
          <div className="modal-title">⚙ Set Monthly Budget Limits</div>
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>
        <div style={{ padding: "0 24px 20px", maxHeight: "60vh", overflowY: "auto" }}>
          <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 16 }}>Set a monthly spending limit per category. Leave blank for no limit.</div>
          {CATEGORIES.filter(c => c.id !== "savings").map(c => (
            <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
              <span style={{ fontSize: 18, width: 24 }}>{c.icon}</span>
              <label style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{c.label}</label>
              <div style={{ position: "relative" }}>
                <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--muted)", fontSize: 13 }}>$</span>
                <input className="form-input" type="number" min="0" step="10"
                  style={{ width: 110, paddingLeft: 22 }}
                  value={form[c.id] || ""}
                  placeholder="No limit"
                  onChange={e => setForm(f => ({ ...f, [c.id]: e.target.value ? parseFloat(e.target.value) : null }))} />
              </div>
            </div>
          ))}
          <div className="modal-actions" style={{ marginTop: 20 }}>
            <button className="btn-ghost" onClick={onClose}>Cancel</button>
            <button className="btn-primary" onClick={() => onSave(form)}>Save Limits</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── CSV Import ───────────────────────────────────────────────────────────────
function CSVImportModal({ onImport, onClose }) {
  const [step, setStep] = useState("upload"); // upload | map | preview
  const [rows, setRows]     = useState([]);
  const [headers, setHeaders] = useState([]);
  const [mapping, setMapping] = useState({ date: "", description: "", amount: "", type: "", category: "" });
  const [preview, setPreview] = useState([]);
  const [error, setError]   = useState("");

  const handleFile = e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const lines = ev.target.result.split("\n").filter(Boolean);
      if (lines.length < 2) { setError("File appears empty."); return; }
      const h = lines[0].split(",").map(h => h.trim().replace(/"/g, ""));
      const r = lines.slice(1).map(l => l.split(",").map(v => v.trim().replace(/"/g, "")));
      setHeaders(h);
      setRows(r);
      // Auto-detect common column names
      const autoMap = { date: "", description: "", amount: "", type: "", category: "" };
      h.forEach((col, i) => {
        const c = col.toLowerCase();
        if (c.includes("date")) autoMap.date = String(i);
        if (c.includes("desc") || c.includes("memo") || c.includes("name")) autoMap.description = String(i);
        if (c.includes("amount") || c.includes("sum") || c.includes("value")) autoMap.amount = String(i);
        if (c.includes("type") || c.includes("debit") || c.includes("credit")) autoMap.type = String(i);
        if (c.includes("categ")) autoMap.category = String(i);
      });
      setMapping(autoMap);
      setStep("map");
    };
    reader.readAsText(file);
  };

  const buildPreview = () => {
    const parsed = rows.slice(0, 5).map(r => ({
      date: mapping.date !== "" ? r[parseInt(mapping.date)] : new Date().toISOString().split("T")[0],
      description: mapping.description !== "" ? r[parseInt(mapping.description)] : "Imported",
      amount: Math.abs(parseFloat(mapping.amount !== "" ? r[parseInt(mapping.amount)] : 0) || 0),
      type: mapping.type !== "" ? (r[parseInt(mapping.type)]?.toLowerCase().includes("credit") ? "income" : "expense") : "expense",
      category: "other",
    }));
    setPreview(parsed);
    setStep("preview");
  };

  const doImport = () => {
    const imported = rows.map(r => ({
      id: uid(),
      date: mapping.date !== "" ? r[parseInt(mapping.date)] : new Date().toISOString().split("T")[0],
      description: mapping.description !== "" ? r[parseInt(mapping.description)] : "Imported",
      amount: Math.abs(parseFloat(mapping.amount !== "" ? r[parseInt(mapping.amount)] : 0) || 0),
      type: mapping.type !== "" ? (r[parseInt(mapping.type)]?.toLowerCase().includes("credit") ? "income" : "expense") : "expense",
      category: "other",
      recurring: false,
    })).filter(r => r.amount > 0);
    onImport(imported);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: 520 }}>
        <div className="modal-header">
          <div className="modal-title">📁 Import from CSV</div>
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>
        <div style={{ padding: "0 24px 24px" }}>
          {step === "upload" && <>
            <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 16 }}>Export a CSV from your bank and upload it here. Works with most bank exports.</div>
            {error && <div style={{ color: "#ef4444", fontSize: 13, marginBottom: 12 }}>{error}</div>}
            <label style={{ display: "block", border: "2px dashed var(--border)", borderRadius: 12, padding: "32px", textAlign: "center", cursor: "pointer", transition: "border-color 0.2s" }}
              onMouseOver={e => e.currentTarget.style.borderColor = "var(--accent)"}
              onMouseOut={e => e.currentTarget.style.borderColor = "var(--border)"}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>📂</div>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Click to select CSV file</div>
              <div style={{ fontSize: 12, color: "var(--muted)" }}>Exported from any bank or app</div>
              <input type="file" accept=".csv" style={{ display: "none" }} onChange={handleFile} />
            </label>
          </>}

          {step === "map" && <>
            <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 16 }}>Map your CSV columns to the right fields. We auto-detected what we could.</div>
            {["date", "description", "amount", "type"].map(field => (
              <div key={field} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                <label style={{ width: 100, fontSize: 13, fontWeight: 600, textTransform: "capitalize" }}>{field}</label>
                <select className="form-select" style={{ flex: 1 }} value={mapping[field]}
                  onChange={e => setMapping(m => ({ ...m, [field]: e.target.value }))}>
                  <option value="">— skip —</option>
                  {headers.map((h, i) => <option key={i} value={String(i)}>{h}</option>)}
                </select>
              </div>
            ))}
            <div className="modal-actions">
              <button className="btn-ghost" onClick={() => setStep("upload")}>Back</button>
              <button className="btn-primary" onClick={buildPreview}>Preview Import</button>
            </div>
          </>}

          {step === "preview" && <>
            <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 12 }}>Preview of first 5 rows. {rows.length} total transactions will be imported.</div>
            <div style={{ background: "var(--surface2)", borderRadius: 10, overflow: "hidden", marginBottom: 16 }}>
              {preview.map((r, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px", borderBottom: i < preview.length - 1 ? "1px solid var(--border)" : "none", fontSize: 13 }}>
                  <div>
                    <div style={{ fontWeight: 500 }}>{r.description}</div>
                    <div style={{ fontSize: 11, color: "var(--muted)" }}>{r.date}</div>
                  </div>
                  <div style={{ color: r.type === "income" ? "#22c55e" : "#ef4444", fontFamily: "Space Mono, monospace", fontWeight: 600 }}>
                    {r.type === "income" ? "+" : "-"}{fmt$(r.amount)}
                  </div>
                </div>
              ))}
            </div>
            <div className="modal-actions">
              <button className="btn-ghost" onClick={() => setStep("map")}>Back</button>
              <button className="btn-primary" onClick={doImport}>Import {rows.length} Transactions</button>
            </div>
          </>}
        </div>
      </div>
    </div>
  );
}

// ─── AI Warnings Panel ────────────────────────────────────────────────────────
function AIWarningsPanel({ transactions, budgetLimits, projects, tasks }) {
  const [warnings, setWarnings] = useState([]);
  const [loading, setLoading]   = useState(false);
  const [lastRun, setLastRun]   = useState(null);

  const runAnalysis = async () => {
    setLoading(true);
    const trends = buildTrends(transactions);
    const thisMonth  = trends[3];
    const lastMonth  = trends[4];
    const last3months = trends[5];

    const budgetStatus = CATEGORIES.map(c => {
      const limit = budgetLimits[c.id];
      const spent = thisMonth.byCategory[c.id] || 0;
      const lastSpent = lastMonth.byCategory[c.id] || 0;
      if (!limit) return null;
      return { category: c.label, icon: c.icon, limit, spent, lastSpent, pct: spent / limit * 100, trend: spent - lastSpent };
    }).filter(Boolean);

    const projectBudgets = projects.filter(p => p.budget > 0).map(p => {
      const spent = transactions.filter(t => t.projectId === p.id && t.type === "expense").reduce((s, t) => s + t.amount, 0);
      return { name: p.name, budget: p.budget, spent, pct: spent / p.budget * 100 };
    });

    const prompt = `You are analyzing a user's finances in their Craiz planner app. Generate 3-5 specific, actionable early warnings based on this data.

SPENDING TRENDS:
This month income: $${thisMonth.income.toFixed(2)}, expenses: $${thisMonth.expenses.toFixed(2)}, net: $${thisMonth.net.toFixed(2)}
Last month income: $${lastMonth.income.toFixed(2)}, expenses: $${lastMonth.expenses.toFixed(2)}, net: $${lastMonth.net.toFixed(2)}
Last 3 months avg expenses: $${(last3months.expenses / 3).toFixed(2)}/month

CATEGORY BUDGET STATUS (this month):
${budgetStatus.map(b => `${b.icon} ${b.category}: spent $${b.spent.toFixed(2)} of $${b.limit.toFixed(2)} limit (${b.pct.toFixed(0)}%) — trend: ${b.trend >= 0 ? "+" : ""}$${b.trend.toFixed(2)} vs last month`).join("\n")}

ACTIVE PROJECTS WITH BUDGETS:
${projectBudgets.length ? projectBudgets.map(p => `"${p.name}": spent $${p.spent.toFixed(2)} of $${p.budget.toFixed(2)} budget (${p.pct.toFixed(0)}%)`).join("\n") : "None"}

OPEN TASKS: ${tasks.filter(t => t.status !== "done").length} tasks pending

Return ONLY a JSON array. Each warning object: { severity: "critical"|"warning"|"info", title: string, body: string (the detailed domino-effect analysis, 2-3 sentences), suggestions: string[] (3-5 specific actions) }

Focus on domino effects: if X continues, it will affect Y, which could cascade into Z. Be specific with dollar amounts.`;

    try {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 1500, messages: [{ role: "user", content: prompt }] }),
      });
      const d = await r.json();
      const text = d.content?.[0]?.text || "[]";
      const clean = text.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);
      setWarnings(Array.isArray(parsed) ? parsed : []);
      setLastRun(new Date().toLocaleTimeString());
    } catch { setWarnings([]); }
    setLoading(false);
  };

  const sevColor = { critical: "#ef4444", warning: "#f97316", info: "#06b6d4" };
  const sevBg    = { critical: "rgba(239,68,68,0.08)", warning: "rgba(249,115,22,0.08)", info: "rgba(6,182,212,0.08)" };
  const sevIcon  = { critical: "🚨", warning: "⚠️", info: "💡" };

  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700 }}>🧠 AI Financial Intelligence</div>
          {lastRun && <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>Last run: {lastRun}</div>}
        </div>
        <button className="btn-primary" style={{ fontSize: 12, padding: "7px 14px" }} onClick={runAnalysis} disabled={loading}>
          {loading ? "Analyzing..." : "Run Analysis"}
        </button>
      </div>

      {warnings.length === 0 && !loading && (
        <div style={{ textAlign: "center", padding: "24px 0", color: "var(--muted)", fontSize: 13 }}>
          Click "Run Analysis" to get AI-powered early warnings about your spending trends, budget risks, and potential financial domino effects.
        </div>
      )}

      {loading && (
        <div style={{ textAlign: "center", padding: "24px 0" }}>
          <div style={{ fontSize: 13, color: "var(--accent)", fontFamily: "Space Mono, monospace" }}>Analyzing trends across all timeframes...</div>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {warnings.map((w, i) => (
          <div key={i} style={{ background: sevBg[w.severity], border: `1px solid ${sevColor[w.severity]}30`, borderLeft: `3px solid ${sevColor[w.severity]}`, borderRadius: 10, padding: "14px 16px" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
              <span style={{ fontSize: 18, flexShrink: 0 }}>{sevIcon[w.severity]}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: sevColor[w.severity], marginBottom: 6 }}>{w.title}</div>
                <div style={{ fontSize: 13, color: "var(--text)", lineHeight: 1.6, marginBottom: 10 }}>{w.body}</div>
                {w.suggestions && w.suggestions.length > 0 && (
                  <>
                    <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1.5, color: "var(--muted)", marginBottom: 6 }}>Suggested Actions</div>
                    <ul style={{ margin: 0, paddingLeft: 16, display: "flex", flexDirection: "column", gap: 4 }}>
                      {w.suggestions.map((s, si) => (
                        <li key={si} style={{ fontSize: 12, color: "var(--text)", lineHeight: 1.5 }}>{s}</li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Bills Manager ────────────────────────────────────────────────────────────
function BillsManager({ bills, onSaveBill, onDeleteBill }) {
  const [adding, setAdding] = useState(false);
  const [form, setForm]     = useState({ name: "", amount: "", dueDay: 1, category: "subscriptions", autoPay: false });
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  const today = new Date().getDate();
  const upcomingBills = bills.map(b => ({
    ...b,
    daysUntil: b.dueDay >= today ? b.dueDay - today : (30 - today) + b.dueDay,
  })).sort((a, b) => a.daysUntil - b.daysUntil);

  const totalMonthly = bills.reduce((s, b) => s + parseFloat(b.amount || 0), 0);

  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700 }}>📅 Recurring Bills</div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{fmt$(totalMonthly)}/month total</div>
        </div>
        <button className="btn-sm" onClick={() => setAdding(true)}>+ Add Bill</button>
      </div>

      {upcomingBills.length === 0 && <div style={{ fontSize: 13, color: "var(--muted)", textAlign: "center", padding: "16px 0" }}>No recurring bills set up yet.</div>}

      {upcomingBills.map(b => (
        <div key={b.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
          <span style={{ fontSize: 18 }}>{CAT_MAP[b.category]?.icon || "📦"}</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{b.name}</div>
            <div style={{ fontSize: 11, color: b.daysUntil <= 3 ? "#f97316" : "var(--muted)" }}>
              Due in {b.daysUntil} day{b.daysUntil !== 1 ? "s" : ""} {b.autoPay ? "· Auto-pay" : "· Manual"}
            </div>
          </div>
          <div style={{ fontFamily: "Space Mono, monospace", fontSize: 13, fontWeight: 700, color: "#ef4444" }}>{fmt$(b.amount)}</div>
          <button className="btn-icon" onClick={() => onDeleteBill(b.id)}>🗑</button>
        </div>
      ))}

      {adding && (
        <div style={{ marginTop: 16, padding: 16, background: "var(--surface2)", borderRadius: 10 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
            <div>
              <label className="form-label">Bill Name</label>
              <input className="form-input" value={form.name} onChange={set("name")} placeholder="Netflix, Rent..." />
            </div>
            <div>
              <label className="form-label">Amount ($)</label>
              <input className="form-input" type="number" value={form.amount} onChange={set("amount")} placeholder="0.00" />
            </div>
            <div>
              <label className="form-label">Due Day of Month</label>
              <input className="form-input" type="number" min="1" max="31" value={form.dueDay} onChange={set("dueDay")} />
            </div>
            <div>
              <label className="form-label">Category</label>
              <select className="form-select" value={form.category} onChange={set("category")}>
                {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
            <input type="checkbox" id="autopay" checked={form.autoPay} onChange={e => setForm(f => ({ ...f, autoPay: e.target.checked }))} style={{ accentColor: "var(--accent)" }} />
            <label htmlFor="autopay" style={{ fontSize: 13 }}>Auto-pay (marks as paid automatically)</label>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn-ghost" onClick={() => setAdding(false)}>Cancel</button>
            <button className="btn-primary" onClick={() => {
              if (form.name && form.amount) { onSaveBill({ ...form, id: uid(), amount: parseFloat(form.amount) }); setAdding(false); setForm({ name: "", amount: "", dueDay: 1, category: "subscriptions", autoPay: false }); }
            }}>Save Bill</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Finance Dashboard ─────────────────────────────────────────────────────────
export function FinanceDashboard({ projects, tasks, onAddTask, onLaunchWidget, activeWidgetIds = [] }) {
  const [transactions, setTransactions] = useState(() => LS.get("craiz_transactions", []));
  const [budgetLimits, setBudgetLimits] = useState(() => LS.get("craiz_budget_limits", {}));
  const [bills, setBills]               = useState(() => LS.get("craiz_bills", []));
  const [txModal, setTxModal]           = useState(null); // null | {} | existing tx
  const [budgetModal, setBudgetModal]   = useState(false);
  const [csvModal, setCSVModal]         = useState(false);
  const [activeTab, setActiveTab]       = useState("overview"); // overview | transactions | bills | warnings
  const [txFilter, setTxFilter]         = useState({ type: "all", category: "all", search: "" });

  // Persist to localStorage
  useEffect(() => { LS.set("craiz_transactions", transactions); }, [transactions]);
  useEffect(() => { LS.set("craiz_budget_limits", budgetLimits);  }, [budgetLimits]);
  useEffect(() => { LS.set("craiz_bills", bills);                  }, [bills]);

  // ── Computed values ─────────────────────────────────────────────────────────
  const trends = useMemo(() => buildTrends(transactions), [transactions]);
  const thisMonth  = trends[3];
  const lastMonth  = trends[4];

  const netChange = thisMonth.net - lastMonth.net;

  // Category spending this month
  const categorySpend = CATEGORIES.map(c => ({
    ...c,
    spent:  thisMonth.byCategory[c.id] || 0,
    budget: budgetLimits[c.id] || 0,
  })).filter(c => c.spent > 0 || c.budget > 0);

  // Filtered transactions
  const filteredTx = useMemo(() => transactions.filter(t => {
    if (txFilter.type !== "all" && t.type !== txFilter.type) return false;
    if (txFilter.category !== "all" && t.category !== txFilter.category) return false;
    if (txFilter.search && !t.description.toLowerCase().includes(txFilter.search.toLowerCase())) return false;
    return true;
  }).sort((a, b) => new Date(b.date) - new Date(a.date)), [transactions, txFilter]);

  // ── Actions ─────────────────────────────────────────────────────────────────
  const saveTx = tx => setTransactions(ts => tx.id && ts.find(t => t.id === tx.id) ? ts.map(t => t.id === tx.id ? tx : t) : [...ts, { ...tx, id: uid() }]);
  const deleteTx = id => setTransactions(ts => ts.filter(t => t.id !== id));
  const saveBill = bill => setBills(bs => [...bs, bill]);
  const deleteBill = id => setBills(bs => bs.filter(b => b.id !== id));
  const importCSV = rows => setTransactions(ts => [...ts, ...rows]);

  const tabs = ["overview", "transactions", "bills", "warnings", "plan model", "bank"];

  return (
    <div className="view">
      <div className="view-header">
        <div>
          <div className="view-title">💰 Finance Dashboard</div>
          <div className="view-sub">Income, expenses, budgets & AI financial intelligence</div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          {onLaunchWidget && <WidgetLaunchBar onLaunch={onLaunchWidget} activeIds={activeWidgetIds} />}
          <button className="btn-sm" onClick={() => setCSVModal(true)}>📁 Import CSV</button>
          <button className="btn-sm" onClick={() => setBudgetModal(true)}>⚙ Budgets</button>
          <button className="btn-primary" onClick={() => setTxModal({})}>+ Add Transaction</button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 24, background: "var(--surface)", borderRadius: 10, padding: 4, width: "fit-content" }}>
        {tabs.map(t => (
          <button key={t} onClick={() => setActiveTab(t)}
            style={{ padding: "7px 16px", borderRadius: 7, border: "none", background: activeTab === t ? "var(--accent)" : "transparent", color: activeTab === t ? "#000" : "var(--muted)", cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "DM Sans, sans-serif", textTransform: "capitalize", transition: "all 0.15s" }}>
            {t === "warnings" ? "🧠 AI Warnings" : t === "plan model" ? "📈 Plan Model" : t === "bank" ? "🏦 Bank" : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW TAB ── */}
      {activeTab === "overview" && (
        <>
          {/* Stat cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 16, marginBottom: 24 }}>
            <StatCard icon="💰" label="Income This Month"  value={fmt$(thisMonth.income)}  color="#22c55e" sub={`${thisMonth.income >= lastMonth.income ? "↑" : "↓"} vs last month`} />
            <StatCard icon="💸" label="Expenses This Month" value={fmt$(thisMonth.expenses)} color="#ef4444" sub={`${thisMonth.expenses <= lastMonth.expenses ? "↓ less" : "↑ more"} than last month`} />
            <StatCard icon="📊" label="Net This Month"      value={fmt$(thisMonth.net)}      color={thisMonth.net >= 0 ? "#22c55e" : "#ef4444"} sub={`${netChange >= 0 ? "↑ +" : "↓ "}${fmt$(Math.abs(netChange))} vs last month`} />
            <StatCard icon="📅" label="Bills This Month"    value={fmt$(bills.reduce((s, b) => s + parseFloat(b.amount || 0), 0))} color="var(--accent2)" sub={`${bills.length} recurring`} />
          </div>

          {/* Category burndown */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 24 }}>
            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: 20 }}>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>📊 Budget Burndown</div>
              {categorySpend.length === 0 && <div style={{ fontSize: 13, color: "var(--muted)", textAlign: "center", padding: "20px 0" }}>No spending logged this month yet.</div>}
              {categorySpend.map(c => (
                <BurndownBar key={c.id} label={`${c.icon} ${c.label}`} spent={c.spent} budget={c.budget || c.spent} color={c.color} />
              ))}
              {Object.keys(budgetLimits).length === 0 && (
                <button className="btn-sm" style={{ marginTop: 8 }} onClick={() => setBudgetModal(true)}>Set Budget Limits →</button>
              )}
            </div>

            {/* Trend summary */}
            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: 20 }}>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>📈 Spending Trends</div>
              {trends.slice(0, 5).map((t, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: i < 4 ? "1px solid var(--border)" : "none" }}>
                  <span style={{ fontSize: 13, color: "var(--muted)" }}>{t.label}</span>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 13, fontWeight: 600, fontFamily: "Space Mono, monospace", color: t.net >= 0 ? "#22c55e" : "#ef4444" }}>
                      {t.net >= 0 ? "+" : ""}{fmt$(t.net)}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--muted)" }}>{fmt$(t.expenses)} spent</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ── TRANSACTIONS TAB ── */}
      {activeTab === "transactions" && (
        <>
          {/* Filters */}
          <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
            <input className="form-input" style={{ flex: 1, minWidth: 180 }} placeholder="Search transactions..." value={txFilter.search} onChange={e => setTxFilter(f => ({ ...f, search: e.target.value }))} />
            <select className="form-select" style={{ width: "auto" }} value={txFilter.type} onChange={e => setTxFilter(f => ({ ...f, type: e.target.value }))}>
              <option value="all">All Types</option>
              <option value="income">Income</option>
              <option value="expense">Expenses</option>
            </select>
            <select className="form-select" style={{ width: "auto" }} value={txFilter.category} onChange={e => setTxFilter(f => ({ ...f, category: e.target.value }))}>
              <option value="all">All Categories</option>
              {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}
            </select>
          </div>

          {/* Transaction list */}
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, overflow: "hidden" }}>
            {filteredTx.length === 0 && (
              <div style={{ textAlign: "center", padding: "40px 20px", color: "var(--muted)", fontSize: 14 }}>
                No transactions yet. Add one or import a CSV.
              </div>
            )}
            {filteredTx.map((t, i) => {
              const cat = CAT_MAP[t.category];
              return (
                <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 20px", borderBottom: i < filteredTx.length - 1 ? "1px solid var(--border)" : "none", transition: "background 0.15s" }}
                  onMouseOver={e => e.currentTarget.style.background = "rgba(255,255,255,0.02)"}
                  onMouseOut={e => e.currentTarget.style.background = "transparent"}>
                  <div style={{ width: 38, height: 38, borderRadius: 10, background: `${cat?.color || "#64748b"}20`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>
                    {cat?.icon || "📦"}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.description}</div>
                    <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                      {fmtDate(t.date)} · {cat?.label || "Other"} {t.recurring ? "· 🔄 Recurring" : ""}
                    </div>
                  </div>
                  <div style={{ fontFamily: "Space Mono, monospace", fontSize: 14, fontWeight: 700, color: t.type === "income" ? "#22c55e" : "#ef4444", flexShrink: 0 }}>
                    {t.type === "income" ? "+" : "-"}{fmt$(t.amount)}
                  </div>
                  <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                    <button className="btn-icon" onClick={() => setTxModal(t)} style={{ fontSize: 12 }}>✏</button>
                    <button className="btn-icon" onClick={() => deleteTx(t.id)} style={{ fontSize: 12 }}>🗑</button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ── BILLS TAB ── */}
      {activeTab === "bills" && (
        <BillsManager bills={bills} onSaveBill={saveBill} onDeleteBill={deleteBill} />
      )}

      {/* ── AI WARNINGS TAB ── */}
      {activeTab === "warnings" && (
        <AIWarningsPanel transactions={transactions} budgetLimits={budgetLimits} projects={projects} tasks={tasks} />
      )}

      {/* ── PLAN MODEL TAB ── */}
      {activeTab === "plan model" && (
        <CurrentPlanModel transactions={transactions} budgetLimits={budgetLimits} projects={projects} tasks={tasks} />
      )}

      {/* ── BANK TAB ── */}
      {activeTab === "bank" && (
        <PlaidConnectionPanel onImportTransactions={rows => setTransactions(ts => [...ts, ...rows])} />
      )}

      {/* Modals */}
      {txModal !== null && <TransactionModal tx={txModal} onSave={tx => { saveTx(tx); setTxModal(null); }} onClose={() => setTxModal(null)} />}
      {budgetModal && <BudgetLimitsModal limits={budgetLimits} onSave={l => { setBudgetLimits(l); setBudgetModal(false); }} onClose={() => setBudgetModal(false)} />}
      {csvModal && <CSVImportModal onImport={importCSV} onClose={() => setCSVModal(false)} />}
    </div>
  );
}

// ─── Finance Summary Widget (for main Dashboard) ──────────────────────────────
export function FinanceSummaryWidget() {
  const transactions = LS.get("craiz_transactions", []);
  const trends = buildTrends(transactions);
  const thisMonth = trends[3];
  const savings = thisMonth.income - thisMonth.expenses;

  if (transactions.length === 0) return null;

  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: "18px 20px" }}>
      <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: 2, color: "var(--muted)", marginBottom: 12, fontFamily: "Space Mono, monospace" }}>This Month</div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
        <span style={{ fontSize: 13, color: "#22c55e" }}>↑ Income</span>
        <span style={{ fontFamily: "Space Mono, monospace", fontSize: 13, color: "#22c55e" }}>{fmt$(thisMonth.income)}</span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
        <span style={{ fontSize: 13, color: "#ef4444" }}>↓ Expenses</span>
        <span style={{ fontFamily: "Space Mono, monospace", fontSize: 13, color: "#ef4444" }}>{fmt$(thisMonth.expenses)}</span>
      </div>
      <div style={{ borderTop: "1px solid var(--border)", paddingTop: 10, display: "flex", justifyContent: "space-between" }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>Net</span>
        <span style={{ fontFamily: "Space Mono, monospace", fontSize: 14, fontWeight: 700, color: savings >= 0 ? "#22c55e" : "#ef4444" }}>{savings >= 0 ? "+" : ""}{fmt$(savings)}</span>
      </div>
    </div>
  );
}
