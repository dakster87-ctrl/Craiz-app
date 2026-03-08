// ─── Craiz Phase 3 ────────────────────────────────────────────────────────────
// Widget Registry · Bill→Task Auto-Creation · Financial Notifications
// Plaid Connection Scaffold · Touch Drag Support · Finance-Aware AI Context

import { useState, useEffect, useRef, useCallback } from "react";

// ─── Shared helpers ───────────────────────────────────────────────────────────
const LS = {
  get: (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};
const fmt$ = n => `$${Math.abs(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const uid  = () => crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2, 9);

// ─── WIDGET REGISTRY ──────────────────────────────────────────────────────────
// All floatable widgets available across the app
export const WIDGET_REGISTRY = [
  { id: "finance-snapshot", icon: "💰", label: "Finance Snapshot",    width: 320, height: 240 },
  { id: "ai-warnings",      icon: "🧠", label: "AI Financial Alerts", width: 380, height: 440 },
  { id: "burnout",          icon: "🔥", label: "Burnout Detector",    width: 300, height: 200 },
  { id: "bills-due",        icon: "📅", label: "Bills Due Soon",      width: 340, height: 340 },
  { id: "task-pulse",       icon: "⚡", label: "Task Pulse",          width: 320, height: 380 },
  { id: "briefing-widget",  icon: "☀",  label: "Daily Briefing",      width: 360, height: 440 },
  { id: "plan-model-mini",  icon: "📈", label: "Balance Curve",       width: 420, height: 360 },
  { id: "consulting-room",  icon: "💼", label: "Consulting Room",     width: 420, height: 520 },
];

// ─── WIDGET POSITION PERSISTENCE ─────────────────────────────────────────────
export function useWidgetManager() {
  const [activeWidgets, setActiveWidgets] = useState(() => LS.get("craiz_widgets", []));
  const [positions, setPositions]         = useState(() => LS.get("craiz_widget_positions", {}));

  useEffect(() => { LS.set("craiz_widgets",           activeWidgets); }, [activeWidgets]);
  useEffect(() => { LS.set("craiz_widget_positions",  positions);     }, [positions]);

  const launch = useCallback((widget) => {
    setActiveWidgets(ws => ws.find(w => w.id === widget.id) ? ws : [...ws, widget]);
  }, []);

  const close = useCallback((id) => {
    setActiveWidgets(ws => ws.filter(w => w.id !== id));
  }, []);

  const savePosition = useCallback((id, pos) => {
    setPositions(ps => ({ ...ps, [id]: pos }));
  }, []);

  const getPosition = useCallback((id, width) => {
    return positions[id] || { x: window.innerWidth - width - 32, y: 80 };
  }, [positions]);

  return { activeWidgets, launch, close, savePosition, getPosition };
}

// ─── ENHANCED FLOATING WIDGET (touch + resize + persistence) ─────────────────
export function FloatingWidgetV2({ id, title, icon, width = 340, height = 420, onClose, onPositionChange, initialPos, children }) {
  const [pos,      setPos]  = useState(initialPos || { x: window.innerWidth - width - 32, y: 80 });
  const [minimized, setMin] = useState(false);
  const dragging  = useRef(false);
  const offset    = useRef({ x: 0, y: 0 });
  const widgetRef = useRef(null);

  // Unified pointer handler (mouse + touch)
  const onPointerDown = (e) => {
    if (e.target.closest("button") && e.target.closest("button") !== e.currentTarget) return;
    dragging.current = true;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    offset.current = { x: clientX - pos.x, y: clientY - pos.y };
    e.preventDefault();
  };

  useEffect(() => {
    const move = (e) => {
      if (!dragging.current) return;
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      const newPos = {
        x: Math.max(0, Math.min(window.innerWidth  - width,  clientX - offset.current.x)),
        y: Math.max(0, Math.min(window.innerHeight - 50,     clientY - offset.current.y)),
      };
      setPos(newPos);
    };
    const up = () => {
      if (dragging.current) {
        dragging.current = false;
        onPositionChange?.(id, pos);
      }
    };
    window.addEventListener("mousemove",  move, { passive: false });
    window.addEventListener("touchmove",  move, { passive: false });
    window.addEventListener("mouseup",    up);
    window.addEventListener("touchend",   up);
    return () => {
      window.removeEventListener("mousemove",  move);
      window.removeEventListener("touchmove",  move);
      window.removeEventListener("mouseup",    up);
      window.removeEventListener("touchend",   up);
    };
  }, [id, pos, width, onPositionChange]);

  return (
    <div ref={widgetRef} style={{
      position: "fixed", left: pos.x, top: pos.y, zIndex: 400,
      width, background: "var(--surface)",
      border: "1px solid var(--border)",
      borderRadius: 14, boxShadow: "0 20px 60px rgba(0,0,0,0.7)",
      overflow: "hidden", userSelect: "none",
      transition: "box-shadow 0.2s",
    }}>
      {/* Title bar — drag handle */}
      <div
        onMouseDown={onPointerDown}
        onTouchStart={onPointerDown}
        style={{
          padding: "9px 12px", background: "var(--surface2)",
          borderBottom: "1px solid var(--border)",
          display: "flex", alignItems: "center", gap: 8,
          cursor: "grab", touchAction: "none",
        }}
      >
        <span style={{ fontSize: 13 }}>{icon}</span>
        <span style={{ flex: 1, fontSize: 12, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--text)" }}>
          {title}
        </span>
        <button
          onClick={() => setMin(m => !m)}
          onMouseDown={e => e.stopPropagation()}
          style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", fontSize: 13, padding: "2px 5px", lineHeight: 1 }}
        >{minimized ? "▢" : "─"}</button>
        <button
          onClick={onClose}
          onMouseDown={e => e.stopPropagation()}
          style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", fontSize: 13, padding: "2px 5px", lineHeight: 1 }}
        >✕</button>
      </div>
      {!minimized && (
        <div style={{ height, overflowY: "auto", overflowX: "hidden" }}>
          {children}
        </div>
      )}
    </div>
  );
}

// ─── WIDGET LAUNCHER BAR ──────────────────────────────────────────────────────
export function WidgetLaunchBar({ onLaunch, activeIds = [] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          padding: "5px 12px", borderRadius: 7, border: "1px solid var(--border)",
          background: open ? "rgba(245,158,11,0.1)" : "transparent",
          color: open ? "var(--accent)" : "var(--muted)",
          cursor: "pointer", fontSize: 12, fontFamily: "DM Sans, sans-serif",
          display: "flex", alignItems: "center", gap: 6, transition: "all 0.15s",
        }}
        title="Float any panel"
      >
        ⊞ <span style={{ fontWeight: 600 }}>Float</span>
      </button>

      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 500,
          background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: 12, padding: "8px", minWidth: 220,
          boxShadow: "0 12px 40px rgba(0,0,0,0.5)",
        }}>
          <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 2, color: "var(--muted)", padding: "4px 10px 8px", fontFamily: "Space Mono, monospace" }}>
            Float a Panel
          </div>
          {WIDGET_REGISTRY.map(w => {
            const active = activeIds.includes(w.id);
            return (
              <button key={w.id}
                onClick={() => { onLaunch(w); setOpen(false); }}
                style={{
                  display: "flex", alignItems: "center", gap: 10, width: "100%",
                  padding: "8px 10px", background: active ? "rgba(245,158,11,0.06)" : "none",
                  border: "none", borderRadius: 8,
                  color: active ? "var(--accent)" : "var(--text)",
                  cursor: "pointer", fontSize: 13, fontFamily: "DM Sans, sans-serif", textAlign: "left",
                  transition: "background 0.1s",
                }}
                onMouseOver={e => { if (!active) e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
                onMouseOut={e => { if (!active) e.currentTarget.style.background = "none"; }}
              >
                <span style={{ width: 22, textAlign: "center" }}>{w.icon}</span>
                <span style={{ flex: 1 }}>{w.label}</span>
                {active && <span style={{ fontSize: 10, color: "var(--accent)" }}>●</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── WIDGET CONTENT COMPONENTS ────────────────────────────────────────────────

export function WidgetFinanceSnapshot() {
  const transactions = LS.get("craiz_transactions", []);
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthTxs = transactions.filter(t => new Date(t.date) >= monthStart);
  const income   = monthTxs.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const expenses = monthTxs.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  const net = income - expenses;
  const bills = LS.get("craiz_bills", []);
  const today = now.getDate();
  const upcoming = bills.filter(b => b.dueDay >= today && b.dueDay <= today + 7).sort((a, b) => a.dueDay - b.dueDay);

  return (
    <div style={{ padding: "16px" }}>
      {transactions.length === 0 ? (
        <div style={{ color: "var(--muted)", fontSize: 13, textAlign: "center", padding: "20px 0" }}>
          No financial data yet.<br />Add transactions in the Finance tab.
        </div>
      ) : (
        <>
          <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 2, color: "var(--muted)", fontFamily: "Space Mono, monospace", marginBottom: 10 }}>This Month</div>
          {[
            { label: "↑ Income",   val: fmt$(income),   color: "#22c55e" },
            { label: "↓ Expenses", val: fmt$(expenses), color: "#ef4444" },
          ].map(r => (
            <div key={r.label} style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 13 }}>
              <span style={{ color: r.color }}>{r.label}</span>
              <span style={{ fontFamily: "Space Mono, monospace", color: r.color, fontWeight: 700 }}>{r.val}</span>
            </div>
          ))}
          <div style={{ borderTop: "1px solid var(--border)", paddingTop: 10, display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>Net</span>
            <span style={{ fontFamily: "Space Mono, monospace", fontSize: 14, fontWeight: 700, color: net >= 0 ? "#22c55e" : "#ef4444" }}>
              {net >= 0 ? "+" : ""}{fmt$(net)}
            </span>
          </div>
          {upcoming.length > 0 && (
            <>
              <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 2, color: "#f97316", fontFamily: "Space Mono, monospace", marginBottom: 8 }}>Bills Due This Week</div>
              {upcoming.map((b, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--text)", marginBottom: 6 }}>
                  <span>{b.name} <span style={{ color: "var(--muted)" }}>· day {b.dueDay}</span></span>
                  <span style={{ color: "#ef4444", fontFamily: "Space Mono, monospace" }}>{fmt$(b.amount)}</span>
                </div>
              ))}
            </>
          )}
        </>
      )}
    </div>
  );
}

export function WidgetBurnout({ tasks }) {
  const computeBurnout = (tasks) => {
    const open = tasks.filter(t => t.status !== "done");
    const overdue = open.filter(t => t.dueDate && new Date(t.dueDate) < new Date()).length;
    const highPri = open.filter(t => t.priority === "critical" || t.priority === "high").length;
    const score = Math.min(100, Math.round((overdue * 15) + (highPri * 8) + (open.length * 1.5)));
    return score;
  };
  const burnout = computeBurnout(tasks);
  const color = burnout < 30 ? "#22c55e" : burnout < 60 ? "#eab308" : "#ef4444";
  const label = burnout < 30 ? "Healthy" : burnout < 60 ? "Moderate" : "High Risk";

  return (
    <div style={{ padding: 16 }}>
      <div style={{ textAlign: "center", marginBottom: 14 }}>
        <div style={{ fontSize: 36, fontWeight: 700, fontFamily: "Space Mono, monospace", color }}>{burnout}</div>
        <div style={{ fontSize: 12, color }}>/ 100 — {label}</div>
      </div>
      <div style={{ height: 8, background: "var(--surface2)", borderRadius: 4, overflow: "hidden", marginBottom: 12 }}>
        <div style={{ height: "100%", width: `${burnout}%`, background: color, borderRadius: 4, transition: "width 0.6s" }} />
      </div>
      <div style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.6 }}>
        {burnout < 30
          ? "Workload is healthy. Keep the rhythm."
          : burnout < 60
          ? "Moderate load. Consider deferring lower-priority tasks."
          : "⚠️ You're overcommitted. Review and defer tasks before you hit a wall."
        }
      </div>
      <div style={{ marginTop: 12, display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--muted)" }}>
        <span>Open tasks: {tasks.filter(t => t.status !== "done").length}</span>
        <span>Overdue: {tasks.filter(t => t.status !== "done" && t.dueDate && new Date(t.dueDate) < new Date()).length}</span>
      </div>
    </div>
  );
}

export function WidgetBillsDue() {
  const bills  = LS.get("craiz_bills", []);
  const today  = new Date().getDate();
  const sorted = [...bills].map(b => ({ ...b, daysUntil: b.dueDay >= today ? b.dueDay - today : (30 - today) + b.dueDay })).sort((a, b) => a.daysUntil - b.daysUntil);

  return (
    <div style={{ padding: 16 }}>
      {sorted.length === 0 ? (
        <div style={{ color: "var(--muted)", fontSize: 13, textAlign: "center", padding: "20px 0" }}>No bills set up yet.</div>
      ) : sorted.map((b, i) => (
        <div key={i} style={{
          padding: "10px 0", borderBottom: i < sorted.length - 1 ? "1px solid var(--border)" : "none",
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 500 }}>{b.name}</div>
            <div style={{ fontSize: 11, marginTop: 2, color: b.daysUntil <= 3 ? "#f97316" : "var(--muted)" }}>
              {b.daysUntil === 0 ? "⚠️ Due today!" : b.daysUntil === 1 ? "⚠️ Due tomorrow" : `Due in ${b.daysUntil} days`}
            </div>
          </div>
          <span style={{ fontFamily: "Space Mono, monospace", fontSize: 13, fontWeight: 700, color: "#ef4444" }}>
            {fmt$(b.amount)}
          </span>
        </div>
      ))}
      <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid var(--border)", display: "flex", justifyContent: "space-between", fontSize: 12 }}>
        <span style={{ color: "var(--muted)" }}>Monthly total</span>
        <span style={{ fontFamily: "Space Mono, monospace", fontWeight: 700 }}>
          {fmt$(bills.reduce((s, b) => s + parseFloat(b.amount || 0), 0))}
        </span>
      </div>
    </div>
  );
}

export function WidgetTaskPulse({ tasks, projects }) {
  const open    = tasks.filter(t => t.status !== "done");
  const overdue = open.filter(t => t.dueDate && new Date(t.dueDate) < new Date());
  const today_s = new Date().toISOString().split("T")[0];
  const dueToday = open.filter(t => t.dueDate === today_s);
  const top5 = [...open].sort((a, b) => {
    const pScore = { critical: 4, high: 3, medium: 2, low: 1 };
    return (pScore[b.priority] || 0) - (pScore[a.priority] || 0);
  }).slice(0, 5);

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        {[
          { label: "Open",    val: open.length,    color: "var(--accent2)" },
          { label: "Today",   val: dueToday.length, color: "#f59e0b" },
          { label: "Overdue", val: overdue.length,  color: "#ef4444" },
        ].map(s => (
          <div key={s.label} style={{ flex: 1, background: "var(--surface2)", borderRadius: 8, padding: "8px 6px", textAlign: "center" }}>
            <div style={{ fontSize: 20, fontWeight: 700, fontFamily: "Space Mono, monospace", color: s.color }}>{s.val}</div>
            <div style={{ fontSize: 10, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 1 }}>{s.label}</div>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 2, color: "var(--muted)", fontFamily: "Space Mono, monospace", marginBottom: 8 }}>Top Priority</div>
      {top5.map((t, i) => {
        const pColor = { critical: "#ef4444", high: "#f97316", medium: "#f59e0b", low: "#94a3b8" };
        const proj = projects.find(p => p.id === t.projectId);
        return (
          <div key={t.id} style={{ padding: "7px 0", borderBottom: i < top5.length - 1 ? "1px solid var(--border)" : "none" }}>
            <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: pColor[t.priority] || "var(--muted)", marginTop: 5, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.title}</div>
                {proj && <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 1 }}>{proj.name}</div>}
              </div>
              {t.dueDate && <div style={{ fontSize: 10, color: new Date(t.dueDate) < new Date() ? "#ef4444" : "var(--muted)", flexShrink: 0 }}>{t.dueDate}</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── BILL → TASK AUTO-CREATION ENGINE ─────────────────────────────────────────
export function useBillTaskSync(bills, tasks, saveTask) {
  useEffect(() => {
    if (!bills?.length || !saveTask) return;
    const today   = new Date();
    const todayN  = today.getDate();
    const WINDOW  = 5; // days ahead to create reminder tasks

    bills.forEach(bill => {
      const daysUntil = bill.dueDay >= todayN ? bill.dueDay - todayN : (30 - todayN) + bill.dueDay;
      if (daysUntil > WINDOW) return; // only create for bills within 5 days

      const taskKey = `bill_task_${bill.id}_${today.getFullYear()}_${today.getMonth()}`;
      const alreadyCreated = localStorage.getItem(taskKey);
      if (alreadyCreated) return;

      // Check if a task for this bill already exists
      const alreadyExists = tasks.some(t =>
        t.title?.toLowerCase().includes(bill.name.toLowerCase()) &&
        t.description?.includes("Auto-created from bill")
      );
      if (alreadyExists) { localStorage.setItem(taskKey, "1"); return; }

      const dueDate = new Date(today.getFullYear(), today.getMonth(), bill.dueDay);
      if (dueDate < today) dueDate.setMonth(dueDate.getMonth() + 1);

      saveTask({
        id: uid(),
        title: `💳 Pay ${bill.name} — ${(bill.amount || 0).toLocaleString("en-US", { style: "currency", currency: "USD" })}`,
        description: `Auto-created from bill reminder. Due day ${bill.dueDay} of each month.`,
        priority: daysUntil <= 2 ? "high" : "medium",
        dueDate: dueDate.toISOString().split("T")[0],
        status: "todo",
        projectId: null,
        effort: 0.1,
      });
      localStorage.setItem(taskKey, "1");
    });
  }, [bills, tasks]);
}

// ─── FINANCIAL BROWSER NOTIFICATIONS ─────────────────────────────────────────
export function useFinancialNotifications(notifEnabled) {
  useEffect(() => {
    if (!notifEnabled || Notification.permission !== "granted") return;

    const checkNotifications = () => {
      const bills      = LS.get("craiz_bills", []);
      const transactions = LS.get("craiz_transactions", []);
      const budgetLimits = LS.get("craiz_budget_limits", {});
      const today      = new Date().getDate();
      const lastNotif  = LS.get("craiz_last_notif_date", null);
      const todayStr   = new Date().toISOString().split("T")[0];

      if (lastNotif === todayStr) return; // only once per day
      LS.set("craiz_last_notif_date", todayStr);

      // Bills due within 2 days
      bills.forEach(bill => {
        const daysUntil = bill.dueDay >= today ? bill.dueDay - today : (30 - today) + bill.dueDay;
        if (daysUntil <= 2) {
          setTimeout(() => {
            new Notification(`💳 Bill Due ${daysUntil === 0 ? "Today" : "Tomorrow"}: ${bill.name}`, {
              body: `$${bill.amount} — don't forget to pay!`,
              icon: "/icon-192.png",
            });
          }, Math.random() * 3000);
        }
      });

      // Budget overage alerts
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthTxs = transactions.filter(t => new Date(t.date) >= monthStart && t.type === "expense");
      const CATS = ["food", "entertainment", "transport", "personal", "subscriptions"];
      CATS.forEach(cat => {
        const limit = budgetLimits[cat];
        if (!limit) return;
        const spent = monthTxs.filter(t => t.category === cat).reduce((s, t) => s + t.amount, 0);
        if (spent >= limit * 0.9) {
          setTimeout(() => {
            new Notification(`⚠️ Budget Alert: ${cat.charAt(0).toUpperCase() + cat.slice(1)}`, {
              body: `$${spent.toFixed(0)} of $${limit} budget used (${Math.round(spent / limit * 100)}%)`,
              icon: "/icon-192.png",
            });
          }, Math.random() * 5000);
        }
      });

      // BBP check-in on the 1st of each month
      const activePlan = LS.get("craiz_active_bbp", null);
      if (activePlan && today === 1) {
        new Notification("📋 Monthly BBP Check-in", {
          body: `Your Balance Budget Plan target is $${activePlan.monthlyTarget?.toFixed(0)}/month. Open Craiz to review your progress.`,
          icon: "/icon-192.png",
        });
      }
    };

    // Check on mount and every hour
    checkNotifications();
    const interval = setInterval(checkNotifications, 3600000);
    return () => clearInterval(interval);
  }, [notifEnabled]);
}

// ─── FINANCE-AWARE CONTEXT BUILDER ───────────────────────────────────────────
// Call this to get a financial context string to inject into AI chat
export function buildFinanceContext() {
  const transactions  = LS.get("craiz_transactions", []);
  const budgetLimits  = LS.get("craiz_budget_limits", {});
  const bills         = LS.get("craiz_bills", []);
  const activePlan    = LS.get("craiz_active_bbp", null);

  if (transactions.length === 0) return "";

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthTxs = transactions.filter(t => new Date(t.date) >= monthStart);
  const income   = monthTxs.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const expenses = monthTxs.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  const net = income - expenses;

  const overBudget = Object.entries(budgetLimits).filter(([cat, limit]) => {
    const spent = monthTxs.filter(t => t.category === cat && t.type === "expense").reduce((s, t) => s + t.amount, 0);
    return spent > limit * 0.8;
  }).map(([cat]) => cat);

  const today  = now.getDate();
  const upcomingBills = bills.filter(b => {
    const d = b.dueDay >= today ? b.dueDay - today : (30 - today) + b.dueDay;
    return d <= 7;
  });

  return `
FINANCIAL CONTEXT:
This month: Income $${income.toFixed(0)}, Expenses $${expenses.toFixed(0)}, Net ${net >= 0 ? "+" : ""}$${net.toFixed(0)}
Budget warnings (>80% spent): ${overBudget.length ? overBudget.join(", ") : "none"}
Bills due this week: ${upcomingBills.length ? upcomingBills.map(b => `${b.name} $${b.amount}`).join(", ") : "none"}
${activePlan ? `Active Budget Plan: $${activePlan.monthlyTarget?.toFixed(0)}/month target` : "No active budget plan"}`;
}

// ─── PLAID CONNECTION SCAFFOLD ────────────────────────────────────────────────
export function PlaidConnectionPanel({ onImportTransactions }) {
  const [status, setStatus]   = useState("idle"); // idle | connecting | connected | error
  const [institution, setInst] = useState(null);
  const [accounts, setAccounts] = useState([]);

  // In production: this would initialize Plaid Link SDK
  // For now: scaffold that shows the flow + instructions
  const initPlaid = () => {
    setStatus("connecting");
    // Simulate the Plaid Link flow
    setTimeout(() => {
      setStatus("error");
    }, 2000);
  };

  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>🏦 Connect Bank Account</div>
          <div style={{ fontSize: 13, color: "var(--muted)" }}>Auto-sync transactions via Plaid (coming soon)</div>
        </div>
        <div style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 6, padding: "4px 10px", fontSize: 11, color: "var(--accent)", fontFamily: "Space Mono, monospace" }}>
          COMING SOON
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>
        {[
          { step: "1", label: "Connect your bank", desc: "Securely link via Plaid — 10,000+ supported banks", done: false },
          { step: "2", label: "Select accounts",    desc: "Choose which checking/savings to sync",           done: false },
          { step: "3", label: "Auto-sync",          desc: "Transactions import daily, categories auto-assigned", done: false },
        ].map(s => (
          <div key={s.step} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            <div style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--surface2)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "var(--muted)", flexShrink: 0 }}>{s.step}</div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{s.label}</div>
              <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{s.desc}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ background: "rgba(6,182,212,0.06)", border: "1px solid rgba(6,182,212,0.15)", borderRadius: 10, padding: "12px 16px", marginBottom: 16, fontSize: 12, color: "var(--muted)", lineHeight: 1.6 }}>
        🔒 Plaid uses bank-grade 256-bit encryption. Craiz never sees your credentials — only read-only transaction data.
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        <button className="btn-primary" style={{ flex: 1, justifyContent: "center", opacity: 0.5, cursor: "not-allowed" }} disabled>
          🏦 Connect with Plaid
        </button>
        <button className="btn-ghost" onClick={() => document.querySelector("[data-csv-import]")?.click()}>
          📁 Import CSV Instead
        </button>
      </div>

      <div style={{ marginTop: 16, padding: "12px 14px", background: "var(--surface2)", borderRadius: 8, fontSize: 12, color: "var(--muted)" }}>
        <strong style={{ color: "var(--text)" }}>To enable Plaid:</strong> Sign up at plaid.com, get your client_id and secret, add them to your .env as VITE_PLAID_CLIENT_ID and VITE_PLAID_SECRET, then add a <code>/api/plaid-link.js</code> serverless function. Full docs at plaid.com/docs.
      </div>
    </div>
  );
}
