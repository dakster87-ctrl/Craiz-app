import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { FinanceDashboard, FinanceSummaryWidget } from "./Finance";
import { FreezeProjectModal, FrozenProjectsView, FloatingWidgetV2, CurrentPlanModel } from "./FinancePhase2";
import {
  WIDGET_REGISTRY, useWidgetManager, WidgetLaunchBar,
  WidgetFinanceSnapshot, WidgetBurnout, WidgetBillsDue, WidgetTaskPulse,
  useBillTaskSync, useFinancialNotifications, buildFinanceContext,
  PlaidConnectionPanel,
} from "./Phase3";

// Shell that loads finance data and passes to CurrentPlanModel
function PlanModelShell({ projects, tasks }) {
  const transactions = JSON.parse(localStorage.getItem("craiz_transactions") || "[]");
  const budgetLimits = JSON.parse(localStorage.getItem("craiz_budget_limits") || "{}");
  return <CurrentPlanModel transactions={transactions} budgetLimits={budgetLimits} projects={projects} tasks={tasks} />;
}

// Mini widget: daily briefing snapshot
function BriefingMiniWidget({ tasks, projects }) {
  const today = new Date().toISOString().split("T")[0];
  const dueToday = tasks.filter(t => t.dueDate === today && t.status !== "done");
  const overdue  = tasks.filter(t => t.dueDate && t.dueDate < today && t.status !== "done");
  return (
    <div style={{ padding: 16 }}>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 12 }}>{new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</div>
      {dueToday.length === 0 && overdue.length === 0
        ? <div style={{ color: "var(--muted)", fontSize: 13 }}>Nothing due today. Great day to get ahead.</div>
        : <>
          {overdue.length > 0 && <div style={{ color: "#ef4444", fontSize: 12, marginBottom: 10 }}>⚠️ {overdue.length} overdue</div>}
          {dueToday.slice(0, 5).map(t => (
            <div key={t.id} style={{ padding: "6px 0", borderBottom: "1px solid var(--border)", fontSize: 12 }}>{t.title}</div>
          ))}
          {dueToday.length > 5 && <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 6 }}>+{dueToday.length - 5} more</div>}
        </>
      }
    </div>
  );
}

// Mini widget: plan model balance quick view
function PlanModelMiniWidget() {
  const transactions = JSON.parse(localStorage.getItem("craiz_transactions") || "[]");
  if (transactions.length === 0) return <div style={{ padding: 16, color: "var(--muted)", fontSize: 13 }}>No financial data yet.</div>;
  const activePlan = JSON.parse(localStorage.getItem("craiz_active_bbp") || "null");
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthTxs = transactions.filter(t => new Date(t.date) >= monthStart);
  const expenses = monthTxs.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  const income   = monthTxs.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const pct = activePlan ? Math.min(expenses / activePlan.monthlyTarget * 100, 100) : null;
  return (
    <div style={{ padding: 16 }}>
      {activePlan ? (
        <>
          <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 10, textTransform: "uppercase", letterSpacing: 1.5, fontFamily: "Space Mono, monospace" }}>BBP Progress</div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 8 }}>
            <span>Spent</span>
            <span style={{ fontFamily: "Space Mono, monospace", color: pct > 90 ? "#ef4444" : "var(--accent)" }}>${expenses.toFixed(0)} / ${activePlan.monthlyTarget?.toFixed(0)}</span>
          </div>
          <div style={{ height: 8, background: "var(--surface2)", borderRadius: 4, overflow: "hidden", marginBottom: 10 }}>
            <div style={{ height: "100%", width: `${pct}%`, background: pct > 90 ? "#ef4444" : "#22c55e", borderRadius: 4 }} />
          </div>
          <div style={{ fontSize: 12, color: "var(--muted)" }}>{(100 - pct).toFixed(0)}% of monthly budget remaining</div>
        </>
      ) : (
        <div style={{ color: "var(--muted)", fontSize: 13 }}>No active Budget Plan. Open Plan Model to generate one.</div>
      )}
    </div>
  );
}

// Mini widget: consulting room shortcut
function ConsultingMiniWidget({ projects }) {
  return (
    <div style={{ padding: 16 }}>
      <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 16, lineHeight: 1.6 }}>
        Open the full Consulting Room from the Plan Model page to speak with the Finance Analyst and Strategy Advisor.
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ padding: "10px 14px", background: "rgba(6,182,212,0.08)", border: "1px solid rgba(6,182,212,0.2)", borderRadius: 10, fontSize: 12 }}>
          <span style={{ color: "#06b6d4", fontWeight: 600 }}>📊 Finance Analyst</span><br />
          <span style={{ color: "var(--muted)" }}>Spending trends, budget risks, domino effects</span>
        </div>
        <div style={{ padding: "10px 14px", background: "rgba(167,139,250,0.08)", border: "1px solid rgba(167,139,250,0.2)", borderRadius: 10, fontSize: 12 }}>
          <span style={{ color: "#a78bfa", fontWeight: 600 }}>🎯 Strategy Advisor</span><br />
          <span style={{ color: "var(--muted)" }}>Goals, project prioritization, long-term planning</span>
        </div>
      </div>
    </div>
  );
}

// ─── AI Helper ───────────────────────────────────────────────────────────────
async function callAI(userPrompt, system = "", json = false) {
  const body = {
    model: "claude-sonnet-4-20250514",
    max_tokens: 1000,
    messages: [{ role: "user", content: userPrompt }],
  };
  if (system) body.system = system;
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const d = await r.json();
    const text = d.content?.[0]?.text || "";
    if (json) {
      const clean = text.replace(/```json|```/g, "").trim();
      return JSON.parse(clean);
    }
    return text;
  } catch (e) {
    return json ? null : "";
  }
}

// Agentic AI call with web search tool support (handles multi-turn tool use loop)
async function callAIWithSearch(messages, system = "") {
  const WEB_SEARCH_TOOL = {
    type: "web_search_20250305",
    name: "web_search",
  };
  let msgs = [...messages];
  let searchesUsed = [];

  for (let turn = 0; turn < 5; turn++) {
    const body = {
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      tools: [WEB_SEARCH_TOOL],
      messages: msgs,
    };
    if (system) body.system = system;

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const d = await r.json();
    if (!d.content) return { text: "Error contacting AI.", searches: searchesUsed };

    const textBlocks = d.content.filter(b => b.type === "text").map(b => b.text).join("\n");
    const toolUseBlocks = d.content.filter(b => b.type === "tool_use");
    const toolResultBlocks = d.content.filter(b => b.type === "tool_result");
    const webSearchBlocks = d.content.filter(b => b.type === "web_search_tool_result");

    // Collect search queries for display
    toolUseBlocks.forEach(b => { if (b.name === "web_search" && b.input?.query) searchesUsed.push(b.input.query); });

    // If stop_reason is end_turn or no tool use, we're done
    if (d.stop_reason === "end_turn" || toolUseBlocks.length === 0) {
      return { text: textBlocks || "No response generated.", searches: searchesUsed };
    }

    // Continue the agentic loop — append assistant turn and tool results
    msgs = [...msgs, { role: "assistant", content: d.content }];

    // Build tool result messages for all tool uses
    const toolResults = toolUseBlocks.map(tu => ({
      type: "tool_result",
      tool_use_id: tu.id,
      content: webSearchBlocks.find(b => b.tool_use_id === tu.id)?.content ||
               toolResultBlocks.find(b => b.tool_use_id === tu.id)?.content ||
               "No results found.",
    }));
    msgs = [...msgs, { role: "user", content: toolResults }];
  }

  return { text: "Research complete.", searches: searchesUsed };
}

// ─── Scoring Utils ───────────────────────────────────────────────────────────
function daysDiff(dateStr) {
  if (!dateStr) return 999;
  return Math.ceil((new Date(dateStr) - new Date()) / (1000 * 60 * 60 * 24));
}
function projectImportanceScore(project, tasks) {
  const pt = tasks.filter((t) => t.projectId === project.id);
  const total = pt.length || 1;
  const critical = pt.filter((t) => t.priority === "critical").length;
  const high = pt.filter((t) => t.priority === "high").length;
  const days = daysDiff(project.deadline);
  const urgency = days <= 0 ? 40 : days <= 3 ? 30 : days <= 7 ? 20 : days <= 14 ? 10 : 5;
  const ratio = ((critical * 2 + high) / (total * 2)) * 20;
  const count = Math.min(pt.length * 2, 15);
  const weight = (project.weight || 5) * 1.5;
  return Math.round(urgency + ratio + count + weight);
}
function taskScore(task) {
  const pm = { critical: 40, high: 30, medium: 20, low: 10 };
  const base = pm[task.priority] || 10;
  const days = daysDiff(task.dueDate);
  const urgency = days <= 0 ? 30 : days <= 2 ? 22 : days <= 5 ? 15 : days <= 10 ? 8 : 3;
  const effort = task.effort ? Math.max(0, 10 - Number(task.effort)) : 5;
  return base + urgency + effort;
}
function computeBurnout(tasks) {
  const open = tasks.filter((t) => t.status !== "done");
  const overdue = open.filter((t) => t.dueDate && daysDiff(t.dueDate) < 0).length;
  const totalEff = open.reduce((s, t) => s + (Number(t.effort) || 0), 0);
  const critical = open.filter((t) => t.priority === "critical").length;
  const overdueRatio = open.length ? overdue / open.length : 0;
  return Math.min(
    Math.round(Math.min(totalEff / 80 * 40, 40) + Math.min(critical * 5, 20) + overdueRatio * 30),
    100
  );
}
function projectRisk(project, tasks) {
  if (!project.deadline) return "unknown";
  const pt = tasks.filter((t) => t.projectId === project.id);
  if (!pt.length) return "low";
  const done = pt.filter((t) => t.status === "done").length;
  const completionRate = done / pt.length;
  const days = daysDiff(project.deadline);
  if (days < 0) return "critical";
  const timeElapsed = Math.max(0, (30 - days) / 30);
  if (timeElapsed > completionRate + 0.3) return "high";
  if (timeElapsed > completionRate + 0.15 || (days < 5 && completionRate < 0.8)) return "medium";
  return "low";
}

// ─── Seed Data ───────────────────────────────────────────────────────────────
const INIT_PROJECTS = [
  { id: "p1", name: "Website Redesign", description: "Full overhaul of company site", deadline: "2026-03-10", weight: 8 },
  { id: "p2", name: "Mobile App MVP", description: "iOS/Android launch ready", deadline: "2026-04-01", weight: 9 },
];
const INIT_TASKS = [
  { id: "t1", projectId: "p1", title: "Wireframes", description: "", priority: "high", dueDate: "2026-02-28", status: "in-progress", effort: 4, actual: null },
  { id: "t2", projectId: "p1", title: "Copy review", description: "", priority: "medium", dueDate: "2026-03-05", status: "todo", effort: 2, actual: null },
  { id: "t3", projectId: "p2", title: "Auth flow", description: "", priority: "critical", dueDate: "2026-03-01", status: "todo", effort: 8, actual: null },
  { id: "t4", projectId: "p2", title: "Push notifications", description: "", priority: "high", dueDate: "2026-03-15", status: "todo", effort: 5, actual: null },
  { id: "t5", projectId: "p1", title: "Design system", description: "", priority: "critical", dueDate: "2026-02-27", status: "todo", effort: 6, actual: null },
];

const PRIORITY_CONFIG = {
  critical: { label: "Critical", color: "#ef4444", bg: "rgba(239,68,68,0.12)" },
  high:     { label: "High",     color: "#f97316", bg: "rgba(249,115,22,0.12)" },
  medium:   { label: "Medium",   color: "#eab308", bg: "rgba(234,179,8,0.12)" },
  low:      { label: "Low",      color: "#3b82f6", bg: "rgba(59,130,246,0.12)" },
};
const STATUS_CONFIG = {
  todo:          { label: "To Do",       color: "#64748b" },
  "in-progress": { label: "In Progress", color: "#f59e0b" },
  done:          { label: "Done",        color: "#22c55e" },
};
const RISK_CONFIG = {
  critical: { label: "🔴 Critical Risk", color: "#ef4444" },
  high:     { label: "🟠 High Risk",     color: "#f97316" },
  medium:   { label: "🟡 Medium Risk",   color: "#eab308" },
  low:      { label: "🟢 On Track",      color: "#22c55e" },
  unknown:  { label: "⚪ No Deadline",   color: "#64748b" },
};

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=DM+Sans:wght@300;400;500;600&display=swap');
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
  :root{
    --bg:#0c0f14;--surface:#131820;--surface2:#1a2230;--surface3:#202b3d;
    --border:rgba(255,255,255,0.07);--accent:#f59e0b;--accent2:#06b6d4;
    --text:#e2e8f0;--muted:#64748b;--danger:#ef4444;--success:#22c55e;
    --sidebar-w:230px;
  }
  body{background:var(--bg);color:var(--text);font-family:'DM Sans',sans-serif;}
  .app{display:flex;min-height:100vh;}

  /* Sidebar */
  .sidebar{width:var(--sidebar-w);background:var(--surface);border-right:1px solid var(--border);display:flex;flex-direction:column;padding:24px 0;position:fixed;height:100vh;z-index:10;overflow-y:auto;}
  .logo{padding:0 20px 24px;border-bottom:1px solid var(--border);}
  .logo-mark{font-family:'Space Mono',monospace;font-size:10px;color:var(--accent);letter-spacing:3px;text-transform:uppercase;}
  .logo-name{font-size:15px;font-weight:600;margin-top:4px;}
  .nav{padding:16px 10px;flex:1;display:flex;flex-direction:column;gap:2px;}
  .nav-section{font-size:9px;text-transform:uppercase;letter-spacing:2px;color:var(--muted);padding:8px 10px 4px;margin-top:6px;}
  .nav-btn{display:flex;align-items:center;gap:10px;padding:9px 12px;border-radius:8px;border:none;background:transparent;color:var(--muted);cursor:pointer;font-family:'DM Sans',sans-serif;font-size:13px;font-weight:500;width:100%;text-align:left;transition:all 0.15s;}
  .nav-btn:hover{color:var(--text);background:var(--surface2);}
  .nav-btn.active{color:var(--accent);background:rgba(245,158,11,0.1);}
  .nav-icon{font-size:15px;width:20px;text-align:center;}
  .streak-pill{margin-left:auto;background:rgba(245,158,11,0.15);color:var(--accent);font-size:10px;font-family:'Space Mono',monospace;padding:2px 6px;border-radius:10px;}

  /* Main */
  .main{margin-left:var(--sidebar-w);flex:1;padding:28px 32px;min-height:100vh;padding-bottom:120px;}
  .page-header{margin-bottom:24px;display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:12px;}
  .page-header-left h1{font-size:24px;font-weight:600;}
  .page-header-left p{color:var(--muted);font-size:13px;margin-top:3px;}

  /* Stat Cards */
  .stat-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:22px;}
  .stat-card{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:18px;position:relative;overflow:hidden;}
  .stat-card::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:var(--accent-line,var(--accent));}
  .stat-label{font-size:10px;text-transform:uppercase;letter-spacing:2px;color:var(--muted);margin-bottom:6px;}
  .stat-value{font-family:'Space Mono',monospace;font-size:28px;font-weight:700;color:var(--stat-color,var(--text));}
  .stat-sub{font-size:11px;color:var(--muted);margin-top:4px;}

  /* AI Pick */
  .ai-pick{background:linear-gradient(135deg,rgba(245,158,11,0.08) 0%,rgba(6,182,212,0.05) 100%);border:1px solid rgba(245,158,11,0.25);border-radius:12px;padding:18px 22px;margin-bottom:22px;position:relative;overflow:hidden;}
  .ai-pick-header{display:flex;align-items:center;gap:10px;margin-bottom:10px;}
  .ai-pick-badge{font-family:'Space Mono',monospace;font-size:9px;background:var(--accent);color:#000;padding:3px 8px;border-radius:4px;font-weight:700;letter-spacing:1px;}
  .ai-pick-title{font-size:15px;font-weight:600;color:var(--accent);}
  .ai-pick-meta{font-size:12px;color:var(--muted);display:flex;align-items:center;gap:8px;flex-wrap:wrap;}
  .ai-pick-reason{font-size:13px;color:var(--text);margin-top:8px;line-height:1.6;opacity:0.9;}
  .ai-loading{display:flex;align-items:center;gap:8px;color:var(--muted);font-size:13px;margin-top:6px;}
  .pulse{width:7px;height:7px;border-radius:50%;background:var(--accent);animation:pulse 1.2s ease-in-out infinite;}
  @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.3}}

  /* Burnout + Risk row */
  .widget-row{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:22px;}
  .widget{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:18px;}
  .widget-title{font-size:10px;text-transform:uppercase;letter-spacing:2px;color:var(--muted);margin-bottom:12px;}
  .burnout-bar-bg{height:8px;background:var(--surface2);border-radius:4px;overflow:hidden;margin-bottom:8px;}
  .burnout-bar-fill{height:100%;border-radius:4px;transition:width 0.6s ease;}
  .burnout-label{font-family:'Space Mono',monospace;font-size:20px;font-weight:700;}
  .burnout-desc{font-size:12px;color:var(--muted);margin-top:4px;}
  .risk-list{display:flex;flex-direction:column;gap:6px;}
  .risk-item{display:flex;align-items:center;justify-content:space-between;font-size:12px;}
  .risk-name{color:var(--text);font-weight:500;}
  .risk-badge{font-size:10px;padding:2px 7px;border-radius:4px;font-family:'Space Mono',monospace;}

  /* Section */
  .section-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;}
  .section-title{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:2px;color:var(--muted);}

  /* Project Grid */
  .proj-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(270px,1fr));gap:14px;}
  .proj-card{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:18px;transition:all 0.2s;position:relative;}
  .proj-card:hover{border-color:rgba(245,158,11,0.3);transform:translateY(-1px);}
  .proj-card-top{display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:10px;}
  .proj-name{font-size:14px;font-weight:600;flex:1;padding-right:10px;}
  .score-badge{font-family:'Space Mono',monospace;font-size:10px;font-weight:700;background:rgba(245,158,11,0.15);color:var(--accent);padding:3px 7px;border-radius:5px;border:1px solid rgba(245,158,11,0.2);white-space:nowrap;}
  .proj-desc{font-size:12px;color:var(--muted);margin-bottom:12px;line-height:1.5;}
  .proj-progress{margin-bottom:12px;}
  .progress-bar-bg{height:3px;background:var(--surface2);border-radius:2px;overflow:hidden;}
  .progress-bar-fill{height:100%;background:var(--accent);border-radius:2px;transition:width 0.5s ease;}
  .progress-text{font-size:10px;color:var(--muted);margin-top:4px;display:flex;justify-content:space-between;}
  .proj-meta{display:flex;gap:10px;font-size:11px;color:var(--muted);flex-wrap:wrap;}
  .proj-actions{display:flex;gap:6px;margin-top:10px;padding-top:10px;border-top:1px solid var(--border);flex-wrap:wrap;}

  /* Buttons */
  .btn-sm{padding:4px 10px;border-radius:6px;border:1px solid var(--border);background:transparent;color:var(--muted);font-size:11px;font-family:'DM Sans',sans-serif;cursor:pointer;transition:all 0.15s;}
  .btn-sm:hover{color:var(--text);border-color:rgba(255,255,255,0.2);}
  .btn-sm.danger:hover{color:var(--danger);border-color:var(--danger);}
  .btn-sm.accent{color:var(--accent);border-color:rgba(245,158,11,0.3);}
  .btn-primary{background:var(--accent);color:#000;border:none;border-radius:8px;padding:8px 16px;font-size:13px;font-weight:600;font-family:'DM Sans',sans-serif;cursor:pointer;transition:all 0.15s;display:flex;align-items:center;gap:6px;}
  .btn-primary:hover{background:#fbbf24;}
  .btn-ghost{background:transparent;border:1px solid var(--border);border-radius:8px;padding:8px 16px;font-size:13px;color:var(--text);font-family:'DM Sans',sans-serif;cursor:pointer;transition:all 0.15s;}
  .btn-ghost:hover{border-color:rgba(255,255,255,0.2);}
  .btn-danger{background:rgba(239,68,68,0.1);color:var(--danger);border:1px solid rgba(239,68,68,0.3);border-radius:8px;padding:8px 16px;font-size:13px;font-family:'DM Sans',sans-serif;cursor:pointer;transition:all 0.15s;}
  .btn-danger:hover{background:rgba(239,68,68,0.2);}
  .btn-icon{background:transparent;border:none;color:var(--muted);cursor:pointer;font-size:16px;padding:4px;border-radius:6px;transition:all 0.15s;display:flex;align-items:center;}
  .btn-icon:hover{color:var(--text);background:var(--surface2);}

  /* Tasks */
  .task-row{background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:12px 16px;display:flex;align-items:center;gap:12px;transition:all 0.15s;margin-bottom:6px;}
  .task-row:hover{border-color:rgba(255,255,255,0.12);}
  .task-check{width:18px;height:18px;border-radius:50%;border:2px solid var(--muted);cursor:pointer;flex-shrink:0;display:flex;align-items:center;justify-content:center;transition:all 0.15s;}
  .task-check.done{background:var(--success);border-color:var(--success);}
  .task-check.done::after{content:'✓';font-size:10px;color:#000;font-weight:700;}
  .task-info{flex:1;min-width:0;}
  .task-title{font-size:13px;font-weight:500;}
  .task-title.done{text-decoration:line-through;color:var(--muted);}
  .task-sub{font-size:11px;color:var(--muted);margin-top:2px;}
  .priority-badge{font-size:10px;font-weight:600;padding:2px 7px;border-radius:4px;white-space:nowrap;font-family:'Space Mono',monospace;}
  .task-score-chip{font-family:'Space Mono',monospace;font-size:9px;color:var(--muted);padding:2px 5px;border:1px solid var(--border);border-radius:4px;}
  .task-actions{display:flex;gap:4px;}

  /* Filters */
  .filter-bar{display:flex;gap:8px;margin-bottom:18px;flex-wrap:wrap;}
  .filter-select{background:var(--surface);border:1px solid var(--border);border-radius:8px;color:var(--text);padding:6px 10px;font-size:12px;font-family:'DM Sans',sans-serif;cursor:pointer;outline:none;}
  .filter-select:focus{border-color:var(--accent);}

  /* Modal */
  .modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:200;display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(4px);}
  .modal{background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:26px;width:100%;max-width:520px;max-height:90vh;overflow-y:auto;}
  .modal-wide{max-width:660px;}
  .modal-title{font-size:17px;font-weight:600;margin-bottom:22px;display:flex;align-items:center;gap:10px;}
  .form-group{margin-bottom:16px;}
  .form-label{font-size:11px;text-transform:uppercase;letter-spacing:1.5px;color:var(--muted);margin-bottom:6px;display:block;}
  .form-input,.form-textarea,.form-select{width:100%;background:var(--surface2);border:1px solid var(--border);border-radius:8px;color:var(--text);padding:9px 12px;font-size:13px;font-family:'DM Sans',sans-serif;outline:none;transition:border-color 0.15s;}
  .form-input:focus,.form-textarea:focus,.form-select:focus{border-color:var(--accent);}
  .form-textarea{resize:vertical;min-height:70px;}
  .form-row{display:grid;grid-template-columns:1fr 1fr;gap:12px;}
  .modal-actions{display:flex;gap:8px;justify-content:flex-end;margin-top:20px;}

  /* Countdown */
  .countdown{font-size:11px;font-family:'Space Mono',monospace;}
  .countdown.overdue{color:var(--danger);}
  .countdown.today{color:var(--accent);}
  .countdown.soon{color:#f97316;}
  .countdown.ok{color:var(--muted);}

  /* Briefing */
  .briefing-card{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:22px;margin-bottom:16px;}
  .briefing-section-label{font-size:10px;text-transform:uppercase;letter-spacing:2px;color:var(--accent);margin-bottom:10px;}
  .briefing-text{font-size:14px;line-height:1.8;color:var(--text);}
  .briefing-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:16px;}

  /* Streak */
  .streak-card{background:linear-gradient(135deg,rgba(245,158,11,0.1),rgba(251,191,36,0.05));border:1px solid rgba(245,158,11,0.2);border-radius:12px;padding:18px;text-align:center;}
  .streak-number{font-family:'Space Mono',monospace;font-size:48px;font-weight:700;color:var(--accent);line-height:1;}
  .streak-label{font-size:11px;color:var(--muted);margin-top:6px;text-transform:uppercase;letter-spacing:2px;}
  .streak-message{font-size:13px;color:var(--text);margin-top:12px;line-height:1.6;padding:10px;background:rgba(0,0,0,0.2);border-radius:8px;}

  /* Focus Mode */
  .focus-mode{position:fixed;inset:0;background:var(--bg);z-index:150;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px;}
  .focus-task-card{background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:28px 32px;max-width:500px;width:100%;margin-bottom:16px;position:relative;}
  .focus-task-num{font-family:'Space Mono',monospace;font-size:10px;color:var(--muted);margin-bottom:8px;text-transform:uppercase;letter-spacing:2px;}
  .focus-task-title{font-size:20px;font-weight:600;margin-bottom:8px;}
  .focus-task-meta{font-size:13px;color:var(--muted);}
  .pomodoro{display:flex;flex-direction:column;align-items:center;margin:28px 0;}
  .pomodoro-ring{width:120px;height:120px;position:relative;margin-bottom:16px;}
  .pomodoro-time{font-family:'Space Mono',monospace;font-size:22px;font-weight:700;color:var(--text);}
  .pomodoro-label{font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:2px;margin-top:4px;}
  .focus-exit{position:absolute;top:20px;right:20px;cursor:pointer;color:var(--muted);font-size:20px;background:none;border:none;}

  /* Celebration */
  .celebration{position:fixed;inset:0;background:rgba(0,0,0,0.8);z-index:300;display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(6px);}
  .celebration-card{background:var(--surface);border:1px solid rgba(245,158,11,0.4);border-radius:20px;padding:36px;max-width:440px;width:100%;text-align:center;}
  .celebration-emoji{font-size:52px;margin-bottom:12px;}
  .celebration-title{font-size:20px;font-weight:700;color:var(--accent);margin-bottom:10px;}
  .celebration-message{font-size:14px;line-height:1.7;color:var(--text);opacity:0.9;}
  @keyframes confetti-pop{0%{transform:scale(0.8);opacity:0}100%{transform:scale(1);opacity:1}}
  .celebration-card{animation:confetti-pop 0.35s ease-out;}

  /* Chat */
  .chat-bubble{position:fixed;bottom:24px;right:24px;z-index:180;}
  .chat-toggle{width:52px;height:52px;border-radius:50%;background:var(--accent);color:#000;border:none;font-size:20px;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 20px rgba(245,158,11,0.4);transition:all 0.2s;}
  .chat-toggle:hover{background:#fbbf24;transform:scale(1.05);}
  .chat-panel-v2{position:fixed;bottom:88px;right:24px;width:420px;height:580px;background:var(--surface);border:1px solid var(--border);border-radius:16px;display:flex;flex-direction:column;z-index:180;box-shadow:0 12px 48px rgba(0,0,0,0.6);overflow:hidden;}
  .chat-header{padding:14px 16px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;background:var(--surface);}
  .chat-header-title{font-size:14px;font-weight:600;}
  .chat-header-sub{font-size:11px;color:var(--muted);}
  .chat-messages{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:10px;}
  .chat-msg{max-width:90%;padding:10px 13px;border-radius:10px;font-size:13px;line-height:1.5;}
  .chat-msg.user{background:rgba(245,158,11,0.15);color:var(--text);align-self:flex-end;border-radius:10px 10px 2px 10px;}
  .chat-msg.ai{background:var(--surface2);color:var(--text);align-self:flex-start;border-radius:10px 10px 10px 2px;max-width:95%;}
  .chat-msg.ai.research{background:rgba(6,182,212,0.06);border:1px solid rgba(6,182,212,0.15);}
  .chat-msg.ai.loading{color:var(--muted);}
  .chat-input-row{display:flex;gap:8px;padding:12px;border-top:1px solid var(--border);}
  .chat-input{flex:1;background:var(--surface2);border:1px solid var(--border);border-radius:8px;color:var(--text);padding:8px 10px;font-size:13px;font-family:'DM Sans',sans-serif;outline:none;resize:none;}
  .chat-input:focus{border-color:var(--accent);}
  .chat-send{background:var(--accent);color:#000;border:none;border-radius:8px;padding:8px 12px;font-size:13px;cursor:pointer;font-weight:600;}
  .chat-send:disabled{opacity:0.5;cursor:not-allowed;}

  /* Time Blocking */
  .time-block-item{display:flex;gap:14px;margin-bottom:8px;align-items:flex-start;}
  .time-block-time{font-family:'Space Mono',monospace;font-size:11px;color:var(--accent);width:80px;flex-shrink:0;padding-top:10px;}
  .time-block-card{flex:1;background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:12px 14px;}
  .time-block-title{font-size:13px;font-weight:500;}
  .time-block-meta{font-size:11px;color:var(--muted);margin-top:3px;}
  .time-block-energy{font-size:10px;padding:2px 6px;border-radius:4px;margin-top:4px;display:inline-block;}

  /* Retro */
  .retro-stat{text-align:center;padding:16px;}
  .retro-stat-num{font-family:'Space Mono',monospace;font-size:32px;font-weight:700;}
  .retro-stat-label{font-size:11px;color:var(--muted);margin-top:4px;text-transform:uppercase;letter-spacing:1px;}
  .retro-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-bottom:18px;}
  .retro-card{background:var(--surface);border:1px solid var(--border);border-radius:12px;}
  .retro-insight{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:20px;margin-bottom:14px;}
  .retro-insight-label{font-size:10px;text-transform:uppercase;letter-spacing:2px;color:var(--accent);margin-bottom:8px;}
  .retro-insight-text{font-size:14px;line-height:1.7;}

  /* NLP bar */
  .nlp-bar{background:var(--surface);border:1px solid rgba(245,158,11,0.2);border-radius:10px;padding:12px 14px;margin-bottom:16px;display:flex;gap:10px;align-items:center;}
  .nlp-input{flex:1;background:transparent;border:none;color:var(--text);font-size:13px;font-family:'DM Sans',sans-serif;outline:none;}
  .nlp-input::placeholder{color:var(--muted);}
  .nlp-hint{font-size:11px;color:var(--muted);}

  /* Notif */
  .notif-bar{background:rgba(6,182,212,0.08);border:1px solid rgba(6,182,212,0.2);border-radius:10px;padding:10px 16px;margin-bottom:18px;display:flex;align-items:center;gap:12px;font-size:13px;}
  .notif-bar-text{flex:1;}
  
  /* Actual hours */
  .actual-badge{font-size:10px;font-family:'Space Mono',monospace;color:var(--accent2);background:rgba(6,182,212,0.1);padding:2px 6px;border-radius:4px;cursor:pointer;}

  /* Generated tasks list */
  .gen-task{display:flex;align-items:center;gap:10px;padding:8px 10px;background:var(--surface2);border-radius:8px;margin-bottom:6px;font-size:13px;}
  .gen-task-check{cursor:pointer;font-size:14px;}
`;

// ─── Shared Components ────────────────────────────────────────────────────────
function Countdown({ dateStr }) {
  const days = daysDiff(dateStr);
  if (!dateStr) return null;
  let cls = "countdown ok", txt = `${days}d left`;
  if (days < 0) { cls = "countdown overdue"; txt = `${Math.abs(days)}d overdue`; }
  else if (days === 0) { cls = "countdown today"; txt = "Today"; }
  else if (days <= 3) { cls = "countdown soon"; txt = `${days}d left`; }
  return <span className={cls}>{txt}</span>;
}
function PriorityBadge({ priority }) {
  const c = PRIORITY_CONFIG[priority] || PRIORITY_CONFIG.low;
  return <span className="priority-badge" style={{ color: c.color, background: c.bg }}>{c.label}</span>;
}

// ─── Modals ───────────────────────────────────────────────────────────────────
function ModalShell({ title, onClose, wide, children }) {
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={`modal${wide ? " modal-wide" : ""}`}>
        <div className="modal-title">{title}</div>
        {children}
      </div>
    </div>
  );
}

function ProjectModal({ project, onSave, onClose }) {
  const [form, setForm] = useState({ name: "", description: "", deadline: "", weight: 5, ...project });
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));
  return (
    <ModalShell title={project ? "Edit Project" : "New Project"} onClose={onClose}>
      <div className="form-group"><label className="form-label">Project Name</label><input className="form-input" value={form.name} onChange={set("name")} placeholder="e.g. Website Redesign" /></div>
      <div className="form-group"><label className="form-label">Description</label><textarea className="form-textarea" value={form.description} onChange={set("description")} /></div>
      <div className="form-row">
        <div className="form-group"><label className="form-label">Deadline</label><input type="date" className="form-input" value={form.deadline} onChange={set("deadline")} /></div>
        <div className="form-group"><label className="form-label">Importance Weight (1–10)</label><input type="number" min="1" max="10" className="form-input" value={form.weight} onChange={set("weight")} /></div>
      </div>
      <div className="modal-actions">
        <button className="btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn-primary" onClick={() => form.name && onSave(form)}>Save Project</button>
      </div>
    </ModalShell>
  );
}

function TaskModal({ task, projects, onSave, onClose }) {
  const [form, setForm] = useState({ projectId: projects[0]?.id || "", title: "", description: "", priority: "medium", dueDate: "", status: "todo", effort: "", actual: null, ...task });
  const [nlp, setNlp] = useState("");
  const [parsing, setParsing] = useState(false);
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  const parseNlp = async () => {
    if (!nlp.trim()) return;
    setParsing(true);
    const result = await callAI(
      `Parse this task description into structured JSON. Description: "${nlp}"
Return ONLY a JSON object with these fields: title (string), priority ("critical"|"high"|"medium"|"low"), dueDate ("YYYY-MM-DD" or null), effort (number hours or null), status ("todo").
Today is ${new Date().toISOString().split("T")[0]}.`, "", true
    );
    if (result) setForm(f => ({ ...f, ...result }));
    setParsing(false);
    setNlp("");
  };

  return (
    <ModalShell title={task ? "Edit Task" : "New Task"} onClose={onClose}>
      {!task && (
        <div className="form-group">
          <label className="form-label">✨ Natural Language Entry</label>
          <div style={{ display: "flex", gap: 8 }}>
            <input className="form-input" value={nlp} onChange={e => setNlp(e.target.value)} placeholder="e.g. Finish homepage design by next Thursday, high priority, ~6hrs" onKeyDown={e => e.key === "Enter" && parseNlp()} />
            <button className="btn-sm accent" onClick={parseNlp} style={{ whiteSpace: "nowrap" }}>{parsing ? "..." : "Parse ✦"}</button>
          </div>
          <div className="nlp-hint" style={{ marginTop: 4 }}>AI will fill the fields below from your description</div>
        </div>
      )}
      <div className="form-group"><label className="form-label">Project</label><select className="form-select" value={form.projectId} onChange={set("projectId")}>{projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
      <div className="form-group"><label className="form-label">Task Title</label><input className="form-input" value={form.title} onChange={set("title")} placeholder="e.g. Design landing page" /></div>
      <div className="form-group"><label className="form-label">Description</label><textarea className="form-textarea" value={form.description} onChange={set("description")} placeholder="Details..." /></div>
      <div className="form-row">
        <div className="form-group"><label className="form-label">Priority</label><select className="form-select" value={form.priority} onChange={set("priority")}><option value="critical">Critical</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select></div>
        <div className="form-group"><label className="form-label">Status</label><select className="form-select" value={form.status} onChange={set("status")}><option value="todo">To Do</option><option value="in-progress">In Progress</option><option value="done">Done</option></select></div>
      </div>
      <div className="form-row">
        <div className="form-group"><label className="form-label">Due Date</label><input type="date" className="form-input" value={form.dueDate} onChange={set("dueDate")} /></div>
        <div className="form-group"><label className="form-label">Est. Effort (hrs)</label><input type="number" min="0.5" step="0.5" className="form-input" value={form.effort} onChange={set("effort")} placeholder="e.g. 4" /></div>
      </div>
      {task && (
        <div className="form-group">
          <label className="form-label">Actual Hours Logged</label>
          <input type="number" min="0" step="0.5" className="form-input" value={form.actual || ""} onChange={set("actual")} placeholder="Log how long it actually took" />
        </div>
      )}
      <div className="modal-actions">
        <button className="btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn-primary" onClick={() => form.title && onSave(form)}>Save Task</button>
      </div>
    </ModalShell>
  );
}

function TaskBreakdownModal({ project, projects, onAddTasks, onClose }) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [generated, setGenerated] = useState([]);
  const [selected, setSelected] = useState({});

  const generate = async () => {
    if (!input.trim()) return;
    setLoading(true);
    const result = await callAI(
      `Break down this project goal into actionable subtasks. Goal: "${input}" for project "${project.name}".
Return ONLY a JSON array of objects, each with: title, priority ("critical"|"high"|"medium"|"low"), effort (hours number), dueDate (null or "YYYY-MM-DD" if obvious from context).
Generate 4-8 tasks. Today is ${new Date().toISOString().split("T")[0]}.`, "", true
    );
    if (result && Array.isArray(result)) {
      setGenerated(result);
      setSelected(Object.fromEntries(result.map((_, i) => [i, true])));
    }
    setLoading(false);
  };

  const addSelected = () => {
    const toAdd = generated.filter((_, i) => selected[i]);
    onAddTasks(toAdd.map(t => ({ ...t, projectId: project.id, status: "todo", description: "" })));
    onClose();
  };

  return (
    <ModalShell title={`🤖 AI Task Breakdown — ${project.name}`} onClose={onClose} wide>
      <div className="form-group">
        <label className="form-label">Describe what needs to be done</label>
        <textarea className="form-textarea" value={input} onChange={e => setInput(e.target.value)} placeholder='e.g. "Launch the mobile app" or "Redesign the homepage"' />
      </div>
      <button className="btn-primary" onClick={generate} style={{ marginBottom: 16 }}>{loading ? "Generating..." : "✦ Generate Subtasks"}</button>
      {generated.length > 0 && (
        <>
          <div className="form-label" style={{ marginBottom: 8 }}>Select tasks to add ({Object.values(selected).filter(Boolean).length} selected)</div>
          {generated.map((t, i) => (
            <div key={i} className="gen-task">
              <span className="gen-task-check" onClick={() => setSelected(s => ({ ...s, [i]: !s[i] }))}>{selected[i] ? "☑" : "☐"}</span>
              <span style={{ flex: 1, fontWeight: 500 }}>{t.title}</span>
              <PriorityBadge priority={t.priority} />
              {t.effort && <span style={{ fontSize: 11, color: "var(--muted)", fontFamily: "Space Mono, monospace" }}>{t.effort}h</span>}
            </div>
          ))}
          <div className="modal-actions">
            <button className="btn-ghost" onClick={onClose}>Cancel</button>
            <button className="btn-primary" onClick={addSelected}>Add Selected Tasks</button>
          </div>
        </>
      )}
    </ModalShell>
  );
}

function CelebrationModal({ task, project, onClose }) {
  const [message, setMessage] = useState("Generating your celebration...");
  const emojis = ["🎉", "🚀", "⚡", "🏆", "✨", "🎯", "💪", "🔥"];
  const emoji = emojis[Math.floor(Math.random() * emojis.length)];
  useEffect(() => {
    callAI(`A user just completed a task. Write a short, energetic, personalized congratulations message (2-3 sentences). Be specific and motivating, not generic.
Task: "${task.title}" (${task.priority} priority, est. ${task.effort || "?"}hrs)
Project: "${project?.name || "Unknown"}"
Make it feel earned and real. Vary your style each time.`).then(setMessage);
  }, []);
  return (
    <div className="celebration" onClick={onClose}>
      <div className="celebration-card" onClick={e => e.stopPropagation()}>
        <div className="celebration-emoji">{emoji}</div>
        <div className="celebration-title">Task Complete!</div>
        <div style={{ fontWeight: 600, marginBottom: 10, color: "var(--text)" }}>{task.title}</div>
        <div className="celebration-message">{message}</div>
        <button className="btn-primary" onClick={onClose} style={{ margin: "18px auto 0", justifyContent: "center" }}>Keep Going →</button>
      </div>
    </div>
  );
}

// ─── AI Pick Card ─────────────────────────────────────────────────────────────
function AiPickCard({ topTask, projects, allTasks }) {
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const proj = projects.find(p => p.id === topTask?.projectId);
  useEffect(() => {
    if (!topTask) return;
    setLoading(true); setReason("");
    const active = allTasks.filter(t => t.status !== "done");
    callAI(`You are a productivity AI. In 1-2 direct sentences, explain WHY this specific task is the most urgent right now.
Task: "${topTask.title}" (${topTask.priority} priority, due: ${topTask.dueDate || "no date"}, ${topTask.effort || "?"}hrs est)
Project: "${proj?.name}" (deadline: ${proj?.deadline || "none"})
Other open tasks: ${active.length - 1}. Be specific, be direct.`).then(r => { setReason(r); setLoading(false); });
  }, [topTask?.id]);
  if (!topTask) return (
    <div className="ai-pick"><div className="ai-pick-header"><span className="ai-pick-badge">AI PICK</span></div><div style={{ color: "var(--muted)", fontSize: 13 }}>No pending tasks — you're all caught up! 🎉</div></div>
  );
  return (
    <div className="ai-pick">
      <div className="ai-pick-header">
        <span className="ai-pick-badge">AI PICK</span>
        <span style={{ color: "var(--muted)", fontSize: 11, fontFamily: "Space Mono, monospace" }}>MOST URGENT NEXT ACTION</span>
      </div>
      <div className="ai-pick-title">{topTask.title}</div>
      <div className="ai-pick-meta">
        <span>{proj?.name}</span>
        <PriorityBadge priority={topTask.priority} />
        {topTask.dueDate && <Countdown dateStr={topTask.dueDate} />}
        {topTask.effort && <span>{topTask.effort}h est</span>}
      </div>
      {loading ? <div className="ai-loading"><div className="pulse" /> Generating insight...</div> : reason ? <div className="ai-pick-reason">{reason}</div> : null}
    </div>
  );
}

// ─── Chat & Research Assistant ────────────────────────────────────────────────
function ChatAssistant({ projects, tasks, onAddTasks }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState("chat"); // "chat" | "research" | "goals"
  const [msgs, setMsgs] = useState([{
    role: "ai",
    text: "Hey! I'm your AI assistant. I can answer questions about your tasks, research topics on the web, or suggest new tasks to help you reach your goals. What do you need?",
    suggestions: null,
    searches: null,
  }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [researchQuery, setResearchQuery] = useState("");
  const [researchLoading, setResearchLoading] = useState(false);
  const [goalInput, setGoalInput] = useState("");
  const [goalProject, setGoalProject] = useState(projects[0]?.id || "none");
  const [goalLoading, setGoalLoading] = useState(false);
  const [pendingTasks, setPendingTasks] = useState([]);
  const [selectedTasks, setSelectedTasks] = useState({});
  const endRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, loading]);

  const buildContext = () => {
    const open_ = tasks.filter(t => t.status !== "done");
    const overdue = open_.filter(t => t.dueDate && daysDiff(t.dueDate) < 0);
    return `You are an AI assistant inside a personal project & task management tool called Craiz.
You have full knowledge of the user's current projects, tasks, and finances. Be concise, direct, and genuinely helpful.
Today: ${new Date().toISOString().split("T")[0]}
Projects: ${projects.map(p => `"${p.name}" (deadline:${p.deadline || "none"}, importance:${projectImportanceScore(p, tasks)})`).join(" | ")}
Open tasks(${open_.length}): ${open_.sort((a,b)=>taskScore(b)-taskScore(a)).slice(0,10).map(t=>`"${t.title}"[${t.priority},due:${t.dueDate||"none"}]`).join(" | ")}
Overdue: ${overdue.length}
${buildFinanceContext()}
If the user asks about the web, current events, best practices, tools, or anything that requires up-to-date information, USE the web_search tool.
If the user asks you to suggest tasks, generate a JSON block wrapped in <tasks>...</tasks> tags containing an array of task objects with: title, priority, effort(hours), projectId(from the list or null), dueDate(YYYY-MM-DD or null), description.
If the user asks about their finances, refer to their financial context above and give specific, actionable advice.
Keep chat responses under 180 words unless doing research.`;
  };

  // Parse <tasks>...</tasks> from AI response text
  const extractTaskSuggestions = (text) => {
    const match = text.match(/<tasks>([\s\S]*?)<\/tasks>/);
    if (!match) return { clean: text, tasks: null };
    try {
      const tasks = JSON.parse(match[1].trim());
      const clean = text.replace(/<tasks>[\s\S]*?<\/tasks>/, "").trim();
      return { clean, tasks };
    } catch { return { clean: text, tasks: null }; }
  };

  const send = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput("");

    const history = msgs.slice(-6).map(m =>
      m.role === "user"
        ? { role: "user", content: userMsg }
        : { role: "assistant", content: m.text }
    );
    const apiMessages = [...history.slice(0, -1), { role: "user", content: userMsg }];

    setMsgs(m => [...m, { role: "user", text: userMsg }]);
    setLoading(true);

    try {
      const { text, searches } = await callAIWithSearch(apiMessages, buildContext());
      const { clean, tasks: suggested } = extractTaskSuggestions(text);
      setMsgs(m => [...m, { role: "ai", text: clean || "Done!", suggestions: suggested, searches: searches.length ? searches : null }]);
      if (suggested) {
        setPendingTasks(suggested);
        setSelectedTasks(Object.fromEntries(suggested.map((_, i) => [i, true])));
      }
    } catch (e) {
      setMsgs(m => [...m, { role: "ai", text: "Something went wrong. Try again." }]);
    }
    setLoading(false);
  };

  const doResearch = async () => {
    if (!researchQuery.trim() || researchLoading) return;
    const query = researchQuery.trim();
    setResearchQuery("");
    setMsgs(m => [...m, { role: "user", text: `🔍 Research: ${query}` }]);
    setTab("chat");
    setResearchLoading(true);
    setLoading(true);

    const system = buildContext() + "\nThe user wants in-depth research. Search the web thoroughly. Write a comprehensive, well-structured summary (up to 400 words). Use bullet points for key findings. Be factual and cite where info came from.";
    try {
      const { text, searches } = await callAIWithSearch(
        [{ role: "user", content: `Research this topic thoroughly and give me a comprehensive summary I can use to plan my work: "${query}". Also suggest any tasks I should add to my planner based on what you find. Wrap task suggestions in <tasks>[...]</tasks> JSON.` }],
        system
      );
      const { clean, tasks: suggested } = extractTaskSuggestions(text);
      setMsgs(m => [...m, { role: "ai", text: clean, suggestions: suggested, searches: searches.length ? searches : null, isResearch: true }]);
      if (suggested) {
        setPendingTasks(suggested);
        setSelectedTasks(Object.fromEntries(suggested.map((_, i) => [i, true])));
      }
    } catch (e) {
      setMsgs(m => [...m, { role: "ai", text: "Research failed. Try again." }]);
    }
    setLoading(false);
    setResearchLoading(false);
  };

  const doGoalTasks = async () => {
    if (!goalInput.trim() || goalLoading) return;
    const goal = goalInput.trim();
    const proj = projects.find(p => p.id === goalProject);
    setGoalLoading(true);

    const result = await callAI(
      `The user wants to accomplish this goal: "${goal}"${proj ? ` for their project "${proj.name}"` : ""}.
Generate 5-10 specific, actionable tasks that will help them achieve this goal. 
Search for best practices if this is a domain-specific goal.
Return ONLY a JSON array where each item has: title, description, priority("critical"|"high"|"medium"|"low"), effort(hours), dueDate(null or YYYY-MM-DD), projectId("${goalProject}" or null).
Today: ${new Date().toISOString().split("T")[0]}. Space tasks out realistically over the coming weeks.`, "", true
    );

    if (result && Array.isArray(result)) {
      setPendingTasks(result);
      setSelectedTasks(Object.fromEntries(result.map((_, i) => [i, true])));
      setMsgs(m => [...m, { role: "user", text: `🎯 Goal: ${goal}` }, { role: "ai", text: `I've generated ${result.length} tasks to help you achieve "${goal}". Review and add the ones that fit below.`, suggestions: result }]);
      setTab("chat");
    }
    setGoalLoading(false);
    setGoalInput("");
  };

  const addSelectedTasks = () => {
    const toAdd = pendingTasks.filter((_, i) => selectedTasks[i]).map(t => ({
      ...t,
      id: Math.random().toString(36).slice(2, 9),
      status: "todo",
      actual: null,
      projectId: t.projectId && t.projectId !== "none" ? t.projectId : (projects[0]?.id || ""),
    }));
    onAddTasks(toAdd);
    setPendingTasks([]);
    setSelectedTasks({});
    setMsgs(m => [...m, { role: "ai", text: `✅ Added ${toAdd.length} task${toAdd.length !== 1 ? "s" : ""} to your planner! Check the Tasks view to see them ranked by priority.`, suggestions: null }]);
  };

  return (
    <div className="chat-bubble">
      {open && (
        <div className="chat-panel-v2">
          {/* Header */}
          <div className="chat-header">
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--accent)", boxShadow: "0 0 6px var(--accent)" }} />
              <div>
                <div className="chat-header-title">✦ AI Assistant</div>
                <div className="chat-header-sub">Chat · Research · Task Generator</div>
              </div>
            </div>
            <button className="btn-icon" onClick={() => setOpen(false)}>✕</button>
          </div>

          {/* Tabs */}
          <div style={{ display: "flex", borderBottom: "1px solid var(--border)", background: "var(--surface2)" }}>
            {[
              { id: "chat", label: "💬 Chat" },
              { id: "research", label: "🔍 Research" },
              { id: "goals", label: "🎯 Goals → Tasks" },
            ].map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                style={{ flex: 1, padding: "9px 6px", border: "none", background: "transparent", cursor: "pointer", fontSize: 11, fontFamily: "DM Sans, sans-serif", fontWeight: 600, letterSpacing: 0.3, color: tab === t.id ? "var(--accent)" : "var(--muted)", borderBottom: tab === t.id ? "2px solid var(--accent)" : "2px solid transparent", transition: "all 0.15s" }}>
                {t.label}
              </button>
            ))}
          </div>

          {/* Chat Messages (always visible) */}
          <div className="chat-messages" style={{ display: tab === "chat" ? "flex" : "none" }}>
            {msgs.map((m, i) => (
              <div key={i}>
                {m.searches && (
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
                    {m.searches.map((s, si) => (
                      <span key={si} style={{ fontSize: 10, background: "rgba(6,182,212,0.1)", color: "var(--accent2)", padding: "2px 7px", borderRadius: 10, fontFamily: "Space Mono, monospace" }}>🔍 {s}</span>
                    ))}
                  </div>
                )}
                <div className={`chat-msg ${m.role}${m.isResearch ? " research" : ""}`}
                  style={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}>
                  {m.text}
                </div>
                {m.suggestions && m.suggestions.length > 0 && i === msgs.length - 1 && pendingTasks.length > 0 && (
                  <div style={{ marginTop: 8, background: "var(--surface2)", borderRadius: 10, padding: 12, border: "1px solid rgba(245,158,11,0.2)" }}>
                    <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 2, color: "var(--accent)", marginBottom: 8 }}>
                      ✦ Suggested Tasks ({Object.values(selectedTasks).filter(Boolean).length} selected)
                    </div>
                    {m.suggestions.map((t, ti) => (
                      <div key={ti} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 6, cursor: "pointer" }} onClick={() => setSelectedTasks(s => ({ ...s, [ti]: !s[ti] }))}>
                        <span style={{ fontSize: 14, marginTop: 1, flexShrink: 0 }}>{selectedTasks[ti] ? "☑" : "☐"}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: selectedTasks[ti] ? "var(--text)" : "var(--muted)" }}>{t.title}</div>
                          {t.description && <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 1 }}>{t.description}</div>}
                          <div style={{ display: "flex", gap: 6, marginTop: 3, alignItems: "center" }}>
                            <PriorityBadge priority={t.priority} />
                            {t.effort && <span style={{ fontSize: 10, color: "var(--muted)", fontFamily: "Space Mono, monospace" }}>{t.effort}h</span>}
                            {t.dueDate && <span style={{ fontSize: 10, color: "var(--muted)", fontFamily: "Space Mono, monospace" }}>{t.dueDate}</span>}
                          </div>
                        </div>
                      </div>
                    ))}
                    <button className="btn-primary" onClick={addSelectedTasks} style={{ marginTop: 8, fontSize: 12, padding: "6px 14px" }}>
                      + Add Selected to Planner
                    </button>
                  </div>
                )}
              </div>
            ))}
            {loading && (
              <div className="chat-msg ai loading" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div className="pulse" />
                <span>Thinking{researchLoading ? " & searching the web" : ""}...</span>
              </div>
            )}
            <div ref={endRef} />
          </div>

          {/* Research Tab */}
          {tab === "research" && (
            <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12, flex: 1 }}>
              <div style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.6 }}>
                Ask me to research any topic — best practices, tools, competitors, how-tos. I'll search the web and summarize findings, then suggest tasks you can add directly to your planner.
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {[
                  "Best practices for mobile app launch",
                  "Top SEO strategies for 2025",
                  "How to run effective sprint planning",
                  "Tools for remote team collaboration",
                ].map(ex => (
                  <button key={ex} onClick={() => { setResearchQuery(ex); }}
                    style={{ textAlign: "left", background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 12px", fontSize: 12, color: "var(--muted)", cursor: "pointer", fontFamily: "DM Sans, sans-serif", transition: "all 0.15s" }}
                    onMouseOver={e => e.target.style.color = "var(--text)"}
                    onMouseOut={e => e.target.style.color = "var(--muted)"}>
                    → {ex}
                  </button>
                ))}
              </div>
              <textarea className="form-textarea" value={researchQuery} onChange={e => setResearchQuery(e.target.value)}
                placeholder="e.g. 'What are the best tools for building a React design system?'"
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); doResearch(); }}}
                style={{ minHeight: 80, resize: "vertical" }} />
              <button className="btn-primary" onClick={doResearch} disabled={researchLoading || !researchQuery.trim()}>
                {researchLoading ? "Searching..." : "🔍 Research & Summarize"}
              </button>
            </div>
          )}

          {/* Goals → Tasks Tab */}
          {tab === "goals" && (
            <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12, flex: 1, overflowY: "auto" }}>
              <div style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.6 }}>
                Describe a goal and I'll generate a full set of tasks to get you there — with priorities, effort estimates, and due dates already set.
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Your Goal</label>
                <textarea className="form-textarea" value={goalInput} onChange={e => setGoalInput(e.target.value)}
                  placeholder={`e.g. "Launch our beta to 500 users by end of March"\n"Build a content marketing strategy"\n"Prepare for the investor pitch deck"`}
                  style={{ minHeight: 90 }} />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Link to Project (optional)</label>
                <select className="form-select" value={goalProject} onChange={e => setGoalProject(e.target.value)}>
                  <option value="none">No project</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              {[
                "Ship the MVP and get first 10 users",
                "Grow social media following to 5,000",
                "Prepare for Q2 investor pitch",
                "Launch email marketing campaign",
              ].map(ex => (
                <button key={ex} onClick={() => setGoalInput(ex)}
                  style={{ textAlign: "left", background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 12px", fontSize: 12, color: "var(--muted)", cursor: "pointer", fontFamily: "DM Sans, sans-serif" }}>
                  → {ex}
                </button>
              ))}
              <button className="btn-primary" onClick={doGoalTasks} disabled={goalLoading || !goalInput.trim()}>
                {goalLoading ? "Generating tasks..." : "🎯 Generate Tasks for This Goal"}
              </button>
            </div>
          )}

          {/* Chat Input */}
          {tab === "chat" && (
            <div className="chat-input-row">
              <textarea ref={inputRef} className="chat-input" rows={1} value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }}}
                placeholder="Ask anything — tasks, research, advice, strategy..." />
              <button className="chat-send" onClick={send} disabled={loading}>↑</button>
            </div>
          )}
        </div>
      )}
      <button className="chat-toggle" onClick={() => setOpen(o => !o)} title="AI Assistant">
        {open ? "✕" : "✦"}
      </button>
    </div>
  );
}

// ─── Focus Mode ───────────────────────────────────────────────────────────────
function FocusMode({ tasks, projects, onToggle, onExit }) {
  const top3 = useMemo(() =>
    tasks.filter(t => t.status !== "done").sort((a, b) => taskScore(b) - taskScore(a)).slice(0, 3),
    [tasks]
  );
  const [current, setCurrent] = useState(0);
  const [seconds, setSeconds] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState("work"); // work | break
  const [encouragement, setEncouragement] = useState("");
  const intervalRef = useRef(null);

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setSeconds(s => {
          if (s <= 1) {
            clearInterval(intervalRef.current);
            setRunning(false);
            const next = phase === "work" ? "break" : "work";
            setPhase(next);
            setSeconds(next === "work" ? 25 * 60 : 5 * 60);
            if (phase === "work") {
              callAI(`Write a single encouraging sentence for someone who just completed a 25-minute focused work session on "${top3[current]?.title}". Be energetic and specific. Under 20 words.`).then(setEncouragement);
              if (Notification.permission === "granted") new Notification("Focus session complete! 🎉 Take a 5-min break.");
            }
            return next === "work" ? 25 * 60 : 5 * 60;
          }
          return s - 1;
        });
      }, 1000);
    } else clearInterval(intervalRef.current);
    return () => clearInterval(intervalRef.current);
  }, [running, phase]);

  const fmt = s => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  const pct = phase === "work" ? ((25 * 60 - seconds) / (25 * 60)) * 100 : ((5 * 60 - seconds) / (5 * 60)) * 100;
  const proj = t => projects.find(p => p.id === t?.projectId);
  const circumference = 2 * Math.PI * 50;

  return (
    <div className="focus-mode">
      <button className="focus-exit" onClick={onExit}>✕ Exit Focus</button>
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <div style={{ fontFamily: "Space Mono, monospace", fontSize: 10, color: "var(--accent)", letterSpacing: 3, marginBottom: 8 }}>// FOCUS MODE</div>
        <div style={{ color: "var(--muted)", fontSize: 13 }}>Your top {top3.length} AI-ranked tasks</div>
      </div>

      {top3.map((t, i) => (
        <div key={t.id} className="focus-task-card" style={{ opacity: i === current ? 1 : 0.4, borderColor: i === current ? "rgba(245,158,11,0.4)" : "var(--border)", cursor: i !== current ? "pointer" : "default" }} onClick={() => i !== current && setCurrent(i)}>
          <div className="focus-task-num">#{i + 1} · {proj(t)?.name}</div>
          <div className="focus-task-title">{t.title}</div>
          <div className="focus-task-meta" style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <PriorityBadge priority={t.priority} />
            {t.dueDate && <Countdown dateStr={t.dueDate} />}
            {t.effort && <span>{t.effort}h est</span>}
          </div>
          {i === current && (
            <button className="btn-primary" style={{ marginTop: 12 }} onClick={() => onToggle(t)}>✓ Mark Complete</button>
          )}
        </div>
      ))}

      <div className="pomodoro">
        <div style={{ position: "relative", width: 120, height: 120 }}>
          <svg width="120" height="120" style={{ transform: "rotate(-90deg)" }}>
            <circle cx="60" cy="60" r="50" fill="none" stroke="var(--surface2)" strokeWidth="6" />
            <circle cx="60" cy="60" r="50" fill="none" stroke={phase === "work" ? "var(--accent)" : "var(--accent2)"} strokeWidth="6"
              strokeDasharray={circumference} strokeDashoffset={circumference * (1 - pct / 100)} strokeLinecap="round" style={{ transition: "stroke-dashoffset 1s linear" }} />
          </svg>
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
            <div className="pomodoro-time">{fmt(seconds)}</div>
            <div className="pomodoro-label" style={{ color: phase === "work" ? "var(--accent)" : "var(--accent2)" }}>{phase}</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn-primary" onClick={() => setRunning(r => !r)}>{running ? "⏸ Pause" : "▶ Start"}</button>
          <button className="btn-ghost" onClick={() => { setRunning(false); setSeconds(25 * 60); setPhase("work"); }}>↺ Reset</button>
        </div>
        {encouragement && <div style={{ marginTop: 14, color: "var(--accent)", fontSize: 13, textAlign: "center", fontStyle: "italic", maxWidth: 340 }}>{encouragement}</div>}
      </div>
    </div>
  );
}

// ─── Daily Briefing View ──────────────────────────────────────────────────────
function BriefingView({ tasks, projects }) {
  const [briefing, setBriefing] = useState(null);
  const [loading, setLoading] = useState(true);
  const today = new Date().toISOString().split("T")[0];
  const dueToday = tasks.filter(t => t.dueDate === today && t.status !== "done");
  const overdue = tasks.filter(t => t.dueDate && daysDiff(t.dueDate) < 0 && t.status !== "done");
  const topTask = tasks.filter(t => t.status !== "done").sort((a, b) => taskScore(b) - taskScore(a))[0];
  const burnout = computeBurnout(tasks);

  useEffect(() => {
    const ctx = `Projects: ${projects.map(p => `"${p.name}" deadline ${p.deadline || "none"}`).join("; ")}
Open tasks: ${tasks.filter(t => t.status !== "done").sort((a, b) => taskScore(b) - taskScore(a)).slice(0, 8).map(t => `"${t.title}" [${t.priority}, due ${t.dueDate || "none"}]`).join("; ")}
Due today: ${dueToday.map(t => t.title).join(", ") || "none"}
Overdue: ${overdue.length} tasks
Burnout score: ${burnout}/100
Today's date: ${today}`;
    callAI(
      `Generate a daily AI briefing for this project manager. Return ONLY a JSON object with these fields:
- greeting: string (2-3 sentences, acknowledge the day, be warm and real)
- priority_summary: string (2-3 sentences on what matters most today, specific task/project names)
- risk_alert: string (1-2 sentences on what's most at risk right now, or "All looks good" if nothing critical)
- motivation: string (1-2 sentences of genuine personalized motivation based on workload)
- focus_recommendation: string (1 sentence on exactly what to work on first and why)
Context: ${ctx}`, "", true
    ).then(r => { setBriefing(r); setLoading(false); });
  }, []);

  const burnoutColor = burnout < 30 ? "#22c55e" : burnout < 60 ? "#eab308" : "#ef4444";
  const burnoutLabel = burnout < 30 ? "Healthy" : burnout < 60 ? "Moderate" : "High — Take Action";

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Daily Briefing</h1>
          <p>AI-powered morning summary · {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</p>
        </div>
      </div>

      <div className="briefing-grid">
        <div className="stat-card" style={{ "--accent-line": "var(--accent)" }}>
          <div className="stat-label">Due Today</div>
          <div className="stat-value" style={{ "--stat-color": dueToday.length ? "var(--accent)" : "var(--text)" }}>{dueToday.length}</div>
          <div className="stat-sub">{dueToday.length ? dueToday.slice(0, 2).map(t => t.title).join(", ") : "Clear schedule"}</div>
        </div>
        <div className="stat-card" style={{ "--accent-line": "var(--danger)" }}>
          <div className="stat-label">Overdue Tasks</div>
          <div className="stat-value" style={{ "--stat-color": overdue.length ? "var(--danger)" : "var(--text)" }}>{overdue.length}</div>
          <div className="stat-sub">{overdue.length ? "Needs immediate attention" : "Nothing overdue"}</div>
        </div>
        <div className="stat-card" style={{ "--accent-line": burnoutColor }}>
          <div className="stat-label">Burnout Risk</div>
          <div className="stat-value" style={{ "--stat-color": burnoutColor }}>{burnout}</div>
          <div className="stat-sub" style={{ color: burnoutColor }}>{burnoutLabel}</div>
        </div>
        <div className="stat-card" style={{ "--accent-line": "var(--accent2)" }}>
          <div className="stat-label">Top Priority Task</div>
          <div className="stat-value" style={{ fontSize: 14, marginTop: 4, "--stat-color": "var(--accent2)" }}>{topTask?.title || "—"}</div>
          <div className="stat-sub">{topTask ? <PriorityBadge priority={topTask.priority} /> : null}</div>
        </div>
      </div>

      {loading ? (
        <div className="briefing-card"><div className="ai-loading"><div className="pulse" /> AI is preparing your briefing...</div></div>
      ) : briefing ? (
        <>
          <div className="briefing-card">
            <div className="briefing-section-label">Good Morning</div>
            <div className="briefing-text">{briefing.greeting}</div>
          </div>
          <div className="briefing-card" style={{ borderColor: "rgba(245,158,11,0.2)" }}>
            <div className="briefing-section-label">⚡ Focus Recommendation</div>
            <div className="briefing-text" style={{ color: "var(--accent)", fontWeight: 500 }}>{briefing.focus_recommendation}</div>
          </div>
          <div className="briefing-grid">
            <div className="briefing-card">
              <div className="briefing-section-label">📋 Today's Priority Summary</div>
              <div className="briefing-text">{briefing.priority_summary}</div>
            </div>
            <div className="briefing-card" style={{ borderColor: overdue.length > 0 ? "rgba(239,68,68,0.2)" : "var(--border)" }}>
              <div className="briefing-section-label">⚠️ Risk Alert</div>
              <div className="briefing-text">{briefing.risk_alert}</div>
            </div>
          </div>
          <div className="briefing-card" style={{ borderColor: "rgba(34,197,94,0.2)", background: "rgba(34,197,94,0.03)" }}>
            <div className="briefing-section-label">💪 Your Motivation</div>
            <div className="briefing-text">{briefing.motivation}</div>
          </div>
        </>
      ) : <div style={{ color: "var(--muted)" }}>Could not generate briefing. Check your connection.</div>}
    </div>
  );
}

// ─── Retrospective View ────────────────────────────────────────────────────────
function RetroView({ tasks, projects }) {
  const [retro, setRetro] = useState(null);
  const [loading, setLoading] = useState(false);

  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0];
  const done = tasks.filter(t => t.status === "done");
  const doneThisWeek = done.length;
  const totalEffortDone = done.reduce((s, t) => s + (Number(t.effort) || 0), 0);
  const open = tasks.filter(t => t.status !== "done");
  const overdue = open.filter(t => t.dueDate && daysDiff(t.dueDate) < 0);
  const withActuals = tasks.filter(t => t.actual && t.effort);
  const avgAccuracy = withActuals.length ? Math.round(withActuals.reduce((s, t) => s + ((Number(t.effort) / Number(t.actual)) * 100), 0) / withActuals.length) : null;

  const generate = async () => {
    setLoading(true);
    const ctx = `
Completed tasks (${doneThisWeek}): ${done.map(t => `"${t.title}" [${t.priority}]`).join("; ")}
Still open (${open.length}): ${open.slice(0, 6).map(t => `"${t.title}" [${t.priority}, due ${t.dueDate || "none"}]`).join("; ")}
Overdue count: ${overdue.length}
Total effort completed: ~${totalEffortDone}hrs
Projects: ${projects.map(p => `"${p.name}"`).join(", ")}
Estimation accuracy: ${avgAccuracy !== null ? `${avgAccuracy}%` : "no data"}
    `;
    const r = await callAI(
      `Generate a weekly productivity retrospective. Return ONLY a JSON object with:
- wins: string (2-3 sentences on what was accomplished, be specific and celebratory)
- slipped: string (2-3 sentences on what didn't get done and why it might have happened, be honest but constructive)
- patterns: string (2-3 sentences on productivity patterns you observe from the data)
- goals: array of 3 strings, each a specific, actionable goal for next week
Context: ${ctx}`, "", true
    );
    setRetro(r); setLoading(false);
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Weekly Retrospective</h1>
          <p>AI-powered review of your week</p>
        </div>
        <button className="btn-primary" onClick={generate} disabled={loading}>{loading ? "Generating..." : "✦ Generate Retro"}</button>
      </div>

      <div className="retro-grid">
        <div className="retro-card"><div className="retro-stat"><div className="retro-stat-num" style={{ color: "var(--success)" }}>{doneThisWeek}</div><div className="retro-stat-label">Tasks Completed</div></div></div>
        <div className="retro-card"><div className="retro-stat"><div className="retro-stat-num" style={{ color: overdue.length ? "var(--danger)" : "var(--text)" }}>{overdue.length}</div><div className="retro-stat-label">Still Overdue</div></div></div>
        <div className="retro-card"><div className="retro-stat"><div className="retro-stat-num" style={{ color: "var(--accent2)" }}>{totalEffortDone}h</div><div className="retro-stat-label">Effort Completed</div></div></div>
      </div>

      {avgAccuracy !== null && (
        <div className="retro-card" style={{ padding: 18, marginBottom: 14, display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ fontFamily: "Space Mono, monospace", fontSize: 28, fontWeight: 700, color: avgAccuracy >= 80 ? "var(--success)" : "var(--accent)" }}>{avgAccuracy}%</div>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>Estimation Accuracy</div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 3 }}>{avgAccuracy >= 90 ? "Excellent — your estimates are very reliable" : avgAccuracy >= 70 ? "Good — slight tendency to under-estimate" : "Tasks are taking significantly longer than expected"}</div>
          </div>
        </div>
      )}

      {!retro && !loading && <div style={{ color: "var(--muted)", fontSize: 14, padding: "20px 0" }}>Click "Generate Retro" to get your AI-powered weekly review.</div>}
      {loading && <div className="briefing-card"><div className="ai-loading"><div className="pulse" /> Analyzing your week...</div></div>}
      {retro && (
        <>
          <div className="retro-insight"><div className="retro-insight-label">🏆 What You Crushed</div><div className="retro-insight-text">{retro.wins}</div></div>
          <div className="retro-insight" style={{ borderColor: "rgba(239,68,68,0.15)" }}><div className="retro-insight-label">📉 What Slipped</div><div className="retro-insight-text">{retro.slipped}</div></div>
          <div className="retro-insight" style={{ borderColor: "rgba(6,182,212,0.15)" }}><div className="retro-insight-label">📊 Patterns Observed</div><div className="retro-insight-text">{retro.patterns}</div></div>
          {retro.goals && (
            <div className="retro-insight" style={{ borderColor: "rgba(34,197,94,0.15)" }}>
              <div className="retro-insight-label">🎯 3 Goals for Next Week</div>
              {retro.goals.map((g, i) => (
                <div key={i} style={{ display: "flex", gap: 10, marginBottom: 8 }}>
                  <span style={{ fontFamily: "Space Mono, monospace", color: "var(--accent)", fontSize: 12 }}>0{i + 1}</span>
                  <span style={{ fontSize: 14, lineHeight: 1.5 }}>{g}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Time Blocking View ───────────────────────────────────────────────────────
function TimeBlockingView({ tasks, projects }) {
  const [schedule, setSchedule] = useState(null);
  const [loading, setLoading] = useState(false);
  const [startHour, setStartHour] = useState("9");
  const [endHour, setEndHour] = useState("17");

  const generate = async () => {
    setLoading(true);
    const open = tasks.filter(t => t.status !== "done").sort((a, b) => taskScore(b) - taskScore(a)).slice(0, 10);
    const ctx = `Tasks to schedule: ${open.map(t => `"${t.title}" [${t.priority}, ${t.effort || 1}hrs, due ${t.dueDate || "no date"}]`).join("; ")}
Work hours: ${startHour}:00 to ${endHour}:00 (${Number(endHour) - Number(startHour)} hours available)
Today: ${new Date().toLocaleDateString("en-US", { weekday: "long" })}`;
    const r = await callAI(
      `Create a daily time-blocked schedule. Return ONLY a JSON array of blocks, each with:
- time: "HH:MM" start time
- title: task title (match exactly from the list)
- duration: hours (number)
- energy: "high" | "medium" | "low" (required energy level)
- note: brief tip for this block (1 sentence)
Rules: schedule high-priority tasks in the morning, use energy levels wisely (high focus tasks early), include a lunch break 12:00-13:00, don't exceed ${Number(endHour) - Number(startHour)} total work hours.
${ctx}`, "", true
    );
    setSchedule(Array.isArray(r) ? r : null); setLoading(false);
  };

  const energyStyle = e => ({ high: { background: "rgba(239,68,68,0.12)", color: "#ef4444" }, medium: { background: "rgba(245,158,11,0.12)", color: "var(--accent)" }, low: { background: "rgba(59,130,246,0.12)", color: "#3b82f6" } }[e] || {});

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1>AI Time Blocking</h1>
          <p>Smart daily schedule based on priority, effort, and energy</p>
        </div>
      </div>
      <div style={{ display: "flex", gap: 12, alignItems: "flex-end", marginBottom: 20, flexWrap: "wrap" }}>
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label">Work Start</label>
          <select className="filter-select" value={startHour} onChange={e => setStartHour(e.target.value)}>
            {[6,7,8,9,10,11].map(h => <option key={h} value={h}>{h}:00 AM</option>)}
          </select>
        </div>
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label">Work End</label>
          <select className="filter-select" value={endHour} onChange={e => setEndHour(e.target.value)}>
            {[15,16,17,18,19,20].map(h => <option key={h} value={h}>{h > 12 ? `${h-12}:00 PM` : `${h}:00 PM`}</option>)}
          </select>
        </div>
        <button className="btn-primary" onClick={generate} disabled={loading}>{loading ? "Building schedule..." : "✦ Generate Schedule"}</button>
      </div>
      {!schedule && !loading && <div style={{ color: "var(--muted)", fontSize: 14 }}>Set your hours and click Generate to get an AI-optimized schedule for today.</div>}
      {loading && <div className="briefing-card"><div className="ai-loading"><div className="pulse" /> Building your optimal schedule...</div></div>}
      {schedule && schedule.map((block, i) => (
        <div key={i} className="time-block-item">
          <div className="time-block-time">{block.time}</div>
          <div className="time-block-card" style={{ borderColor: block.title === "Lunch Break" ? "var(--border)" : "rgba(245,158,11,0.1)" }}>
            <div className="time-block-title">{block.title}</div>
            <div className="time-block-meta">{block.duration}h · {block.note}</div>
            {block.energy && <span className="time-block-energy" style={energyStyle(block.energy)}>{block.energy} energy</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
function Dashboard({ projects, tasks, streak, onNewProject, onNewTask, onEditProject, onDeleteProject, onBreakdown, onFreeze, onThaw, onLaunchWidget, activeWidgetIds }) {
  const today = new Date().toISOString().split("T")[0];
  const dueToday = tasks.filter(t => t.dueDate === today && t.status !== "done").length;
  const overdue = tasks.filter(t => t.dueDate && daysDiff(t.dueDate) < 0 && t.status !== "done").length;
  const done = tasks.filter(t => t.status === "done").length;
  const burnout = computeBurnout(tasks);
  const burnoutColor = burnout < 30 ? "#22c55e" : burnout < 60 ? "#eab308" : "#ef4444";

  const sortedProjects = useMemo(() =>
    [...projects].filter(p => !p.frozen).sort((a, b) => projectImportanceScore(b, tasks) - projectImportanceScore(a, tasks)),
    [projects, tasks]
  );
  const topTask = useMemo(() => tasks.filter(t => t.status !== "done").sort((a, b) => taskScore(b) - taskScore(a))[0], [tasks]);

  const getProgress = p => {
    const pt = tasks.filter(t => t.projectId === p.id);
    return pt.length ? Math.round(pt.filter(t => t.status === "done").length / pt.length * 100) : 0;
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left"><h1>Mission Control</h1><p>AI-ranked overview of all your projects and tasks</p></div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <WidgetLaunchBar onLaunch={onLaunchWidget} activeIds={activeWidgetIds} />
          <button className="btn-ghost" onClick={onNewTask} style={{ fontSize: 12 }}>+ Task</button>
          <button className="btn-primary" onClick={onNewProject} style={{ fontSize: 12 }}>+ Project</button>
        </div>
      </div>

      <div className="stat-grid">
        <div className="stat-card" style={{ "--accent-line": "var(--accent2)" }}>
          <div className="stat-label">Total Projects</div>
          <div className="stat-value" style={{ "--stat-color": "var(--accent2)" }}>{projects.length}</div>
        </div>
        <div className="stat-card" style={{ "--accent-line": "#f97316" }}>
          <div className="stat-label">Due Today</div>
          <div className="stat-value" style={{ "--stat-color": dueToday > 0 ? "#f97316" : "var(--text)" }}>{dueToday}</div>
        </div>
        <div className="stat-card" style={{ "--accent-line": "var(--danger)" }}>
          <div className="stat-label">Overdue</div>
          <div className="stat-value" style={{ "--stat-color": overdue > 0 ? "var(--danger)" : "var(--text)" }}>{overdue}</div>
        </div>
        <div className="stat-card" style={{ "--accent-line": burnoutColor }}>
          <div className="stat-label">Burnout Risk</div>
          <div className="stat-value" style={{ "--stat-color": burnoutColor, fontSize: 22, paddingTop: 6 }}>{burnout < 30 ? "Low" : burnout < 60 ? "Moderate" : "High"}</div>
          <div className="stat-sub" style={{ color: burnoutColor }}>{burnout}/100</div>
        </div>
      </div>

      <AiPickCard topTask={topTask} projects={projects} allTasks={tasks} />

      <div className="widget-row">
        <div className="widget">
          <div className="widget-title">🔥 Burnout Detector</div>
          <div className="burnout-bar-bg"><div className="burnout-bar-fill" style={{ width: `${burnout}%`, background: burnoutColor }} /></div>
          <div className="burnout-label" style={{ color: burnoutColor }}>{burnout}/100</div>
          <div className="burnout-desc">
            {burnout < 30 ? "Workload is healthy. You're in a good rhythm." : burnout < 60 ? "Moderate load. Consider deferring lower-priority tasks." : "⚠️ You're overcommitted. Review and defer tasks before you hit a wall."}
          </div>
        </div>
        <div className="widget">
          <div className="widget-title">📡 Project Risk Radar</div>
          <div className="risk-list">
            {sortedProjects.slice(0, 4).map(p => {
              const risk = projectRisk(p, tasks);
              const rc = RISK_CONFIG[risk];
              return (
                <div key={p.id} className="risk-item">
                  <span className="risk-name">{p.name}</span>
                  <span className="risk-badge" style={{ color: rc.color, background: `${rc.color}18` }}>{rc.label}</span>
                </div>
              );
            })}
          </div>
        </div>
        <div className="widget">
          <div className="widget-title">💰 Financial Snapshot</div>
          <FinanceSummaryWidget />
        </div>
      </div>

      {streak > 0 && (
        <div style={{ marginBottom: 22 }}>
          <div className="section-header"><span className="section-title">Momentum Streak</span></div>
          <div className="streak-card" style={{ display: "flex", alignItems: "center", gap: 20, textAlign: "left" }}>
            <div style={{ textAlign: "center" }}>
              <div className="streak-number">{streak}</div>
              <div className="streak-label">Day Streak 🔥</div>
            </div>
            <div style={{ fontSize: 13, color: "var(--text)", opacity: 0.85, lineHeight: 1.6 }}>
              {streak >= 7 ? "You're on fire! A full week of momentum — this consistency compounds." : streak >= 3 ? "Great rhythm building up. Keep completing tasks daily to grow your streak." : "Good start! Complete at least one task daily to keep your streak alive."}
            </div>
          </div>
        </div>
      )}

      <div className="section-header">
        <span className="section-title">Projects by Importance</span>
      </div>
      <div className="proj-grid">
        {sortedProjects.map(p => {
          const score = projectImportanceScore(p, tasks);
          const progress = getProgress(p);
          const pt = tasks.filter(t => t.projectId === p.id);
          const risk = projectRisk(p, tasks);
          const rc = RISK_CONFIG[risk];
          return (
            <div key={p.id} className="proj-card">
              <div className="proj-card-top">
                <div className="proj-name">{p.name}</div>
                <div className="score-badge">⚡ {score}</div>
              </div>
              <div className="proj-desc">{p.description || "No description"}</div>
              <div className="proj-progress">
                <div className="progress-bar-bg"><div className="progress-bar-fill" style={{ width: `${progress}%` }} /></div>
                <div className="progress-text"><span>{progress}% complete</span><span>{pt.filter(t => t.status === "done").length}/{pt.length} tasks</span></div>
              </div>
              <div className="proj-meta">
                {p.deadline && <Countdown dateStr={p.deadline} />}
                <span style={{ color: rc.color, fontSize: 10, fontFamily: "Space Mono, monospace" }}>{rc.label}</span>
              </div>
              <div className="proj-actions">
                <button className="btn-sm" onClick={() => onEditProject(p)}>Edit</button>
                <button className="btn-sm accent" onClick={() => onBreakdown(p)}>✦ AI Breakdown</button>
                <button className="btn-sm" style={{ color: "#06b6d4", borderColor: "rgba(6,182,212,0.3)" }} onClick={() => onFreeze(p)}>🧊 Freeze</button>
                <button className="btn-sm danger" onClick={() => { if (confirm(`Delete "${p.name}"?`)) { /* handled up */ } }}>Delete</button>
              </div>
            </div>
          );
        })}
      </div>
      <FrozenProjectsView projects={projects} onThaw={onThaw} onDelete={onDeleteProject} />
    </div>
  );
}

// ─── Projects View ────────────────────────────────────────────────────────────
function ProjectsView({ projects, tasks, onNew, onEdit, onDelete, onBreakdown }) {
  const sorted = useMemo(() => [...projects].sort((a, b) => projectImportanceScore(b, tasks) - projectImportanceScore(a, tasks)), [projects, tasks]);
  return (
    <div>
      <div className="page-header">
        <div className="page-header-left"><h1>Projects</h1><p>Sorted by AI importance score</p></div>
        <button className="btn-primary" onClick={onNew}>+ New Project</button>
      </div>
      <div className="proj-grid">
        {sorted.map(p => {
          const score = projectImportanceScore(p, tasks);
          const pt = tasks.filter(t => t.projectId === p.id);
          const done = pt.filter(t => t.status === "done").length;
          const progress = pt.length ? Math.round(done / pt.length * 100) : 0;
          const risk = projectRisk(p, tasks);
          const rc = RISK_CONFIG[risk];
          return (
            <div key={p.id} className="proj-card">
              <div className="proj-card-top"><div className="proj-name">{p.name}</div><div className="score-badge">⚡ {score}</div></div>
              <div className="proj-desc">{p.description || "No description"}</div>
              <div className="proj-progress">
                <div className="progress-bar-bg"><div className="progress-bar-fill" style={{ width: `${progress}%` }} /></div>
                <div className="progress-text"><span>{progress}% complete</span><span>{done}/{pt.length} tasks</span></div>
              </div>
              <div className="proj-meta">
                {p.deadline && <Countdown dateStr={p.deadline} />}
                <span style={{ color: rc.color, fontSize: 10, fontFamily: "Space Mono, monospace" }}>{rc.label}</span>
                <span>Weight: {p.weight}/10</span>
              </div>
              <div className="proj-actions">
                <button className="btn-sm" onClick={() => onEdit(p)}>Edit</button>
                <button className="btn-sm accent" onClick={() => onBreakdown(p)}>✦ AI Tasks</button>
                <button className="btn-sm danger" onClick={() => onDelete(p.id)}>Delete</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Tasks View ───────────────────────────────────────────────────────────────
function TasksView({ tasks, projects, onNew, onEdit, onDelete, onToggle }) {
  const [fp, setFp] = useState("all"), [fs, setFs] = useState("all"), [fpr, setFpr] = useState("all");
  const [logTask, setLogTask] = useState(null);
  const [logVal, setLogVal] = useState("");

  const filtered = useMemo(() => {
    let t = [...tasks];
    if (fp !== "all") t = t.filter(x => x.projectId === fp);
    if (fs !== "all") t = t.filter(x => x.status === fs);
    if (fpr !== "all") t = t.filter(x => x.priority === fpr);
    return t.sort((a, b) => taskScore(b) - taskScore(a));
  }, [tasks, fp, fs, fpr]);

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left"><h1>All Tasks</h1><p>AI-ranked by urgency, priority, and effort</p></div>
        <button className="btn-primary" onClick={onNew}>+ New Task</button>
      </div>
      <div className="filter-bar">
        <select className="filter-select" value={fp} onChange={e => setFp(e.target.value)}>
          <option value="all">All Projects</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select className="filter-select" value={fs} onChange={e => setFs(e.target.value)}>
          <option value="all">All Statuses</option>
          <option value="todo">To Do</option>
          <option value="in-progress">In Progress</option>
          <option value="done">Done</option>
        </select>
        <select className="filter-select" value={fpr} onChange={e => setFpr(e.target.value)}>
          <option value="all">All Priorities</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
      </div>

      {logTask && (
        <div className="modal-overlay" onClick={() => setLogTask(null)}>
          <div className="modal" style={{ maxWidth: 360 }} onClick={e => e.stopPropagation()}>
            <div className="modal-title">Log Actual Hours</div>
            <div style={{ fontSize: 14, marginBottom: 12, color: "var(--muted)" }}>Task: {logTask.title}</div>
            <div style={{ display: "flex", gap: 8 }}>
              <input className="form-input" type="number" min="0.5" step="0.5" value={logVal} onChange={e => setLogVal(e.target.value)} placeholder={`Estimated: ${logTask.effort || "?"}h`} />
              <button className="btn-primary" onClick={() => { onEdit({ ...logTask, actual: logVal }); setLogTask(null); setLogVal(""); }}>Save</button>
            </div>
          </div>
        </div>
      )}

      {filtered.map(t => {
        const proj = projects.find(p => p.id === t.projectId);
        return (
          <div key={t.id} className="task-row">
            <div className={`task-check ${t.status === "done" ? "done" : ""}`} onClick={() => onToggle(t)} />
            <div className="task-info">
              <div className={`task-title ${t.status === "done" ? "done" : ""}`}>{t.title}</div>
              <div className="task-sub">{proj?.name}{t.effort ? ` · ${t.effort}h est` : ""}{t.actual ? ` · ${t.actual}h actual` : ""}</div>
            </div>
            <PriorityBadge priority={t.priority} />
            <span className="task-score-chip">{taskScore(t)}</span>
            {t.dueDate && <Countdown dateStr={t.dueDate} />}
            <span style={{ fontSize: 10, color: STATUS_CONFIG[t.status]?.color || "var(--muted)", fontFamily: "Space Mono, monospace" }}>{STATUS_CONFIG[t.status]?.label}</span>
            {t.effort && !t.actual && <span className="actual-badge" onClick={() => { setLogTask(t); setLogVal(""); }}>Log hrs</span>}
            {t.actual && <span className="actual-badge">{t.actual}h actual</span>}
            <div className="task-actions">
              <button className="btn-sm" onClick={() => onEdit(t)}>Edit</button>
              <button className="btn-sm danger" onClick={() => onDelete(t.id)}>✕</button>
            </div>
          </div>
        );
      })}
      {filtered.length === 0 && <div style={{ color: "var(--muted)", fontSize: 14, padding: "20px 0" }}>No tasks match your filters.</div>}
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function Planner({ user, profile, isTrialing, onSignOut, projects = [], tasks = [], syncing, offline, saveProject: extSaveProject, deleteProject, saveTask: extSaveTask, deleteTask, bulkAddTasks }) {
  const [view, setView] = useState("dashboard");
  const [projModal, setProjModal] = useState(null);
  const [taskModal, setTaskModal] = useState(null);
  const [breakdownProject, setBreakdownProject] = useState(null);
  const [celebration, setCelebration] = useState(null);
  const [streak, setStreak] = useState(() => { try { return JSON.parse(localStorage.getItem("craiz_streak") || "{}").current || 0; } catch { return 0; } });
  const [focusMode, setFocusMode] = useState(false);
  const [notifEnabled, setNotifEnabled] = useState(Notification.permission === "granted");
  const [freezeModal, setFreezeModal] = useState(null);
  const { activeWidgets, launch: launchWidget, close: closeWidget, savePosition, getPosition } = useWidgetManager();

  // Phase 3 hooks
  const bills = JSON.parse(localStorage.getItem("craiz_bills") || "[]");
  useBillTaskSync(bills, tasks, saveTask);
  useFinancialNotifications(notifEnabled);

  const freezeProject = (projectId, freezeData) => {
    const proj = projects.find(p => p.id === projectId);
    if (proj) saveProject({ ...proj, frozen: freezeData });
    setFreezeModal(null);
  };

  const thawProject = (projectId) => {
    const proj = projects.find(p => p.id === projectId);
    if (proj) saveProject({ ...proj, frozen: null });
  };

  const saveProject = form => {
    extSaveProject({ ...form, weight: Number(form.weight) || 5 });
    setProjModal(null);
  };

  const saveTask = form => {
    extSaveTask({ ...form, effort: Number(form.effort) || 0, actual: form.actual ? Number(form.actual) : null });
    setTaskModal(null);
  };

  const toggleTask = task => {
    const next = task.status === "done" ? "todo" : "done";
    extSaveTask({ ...task, status: next });
    if (next === "done") {
      const newStreak = streak + 1;
      setStreak(newStreak);
      localStorage.setItem("craiz_streak", JSON.stringify({ current: newStreak, lastDate: new Date().toISOString().split("T")[0] }));
      if (task.priority === "critical" || task.priority === "high") setCelebration(task);
      if (notifEnabled && Notification.permission === "granted") new Notification(`✅ "${task.title}" complete!`, { body: "Great work!" });
    }
  };

  const addGeneratedTasks = tasksArr => {
    bulkAddTasks(tasksArr.map(t => ({ ...t, effort: Number(t.effort) || 0, actual: null })));
  };

  const enableNotifications = () => {
    Notification.requestPermission().then(p => {
      if (p === "granted") {
        setNotifEnabled(true);
        new Notification("🎯 Craiz alerts enabled!", { body: "You'll get notified on completions, bills, and budget warnings." });
      }
    });
  };

  const navItems = [
    { section: "Overview" },
    { id: "dashboard", icon: "◈", label: "Dashboard" },
    { id: "briefing", icon: "☀", label: "Daily Briefing" },
    { section: "Work" },
    { id: "focus", icon: "⊕", label: "Focus Mode" },
    { id: "timeblock", icon: "⊞", label: "Time Blocks" },
    { section: "Manage" },
    { id: "projects", icon: "◫", label: "Projects" },
    { id: "tasks", icon: "◻", label: "Tasks" },
    { section: "Finance" },
    { id: "finance", icon: "💰", label: "Finance" },
    { id: "planmodel", icon: "📈", label: "Plan Model" },
    { section: "Reflect" },
    { id: "retro", icon: "◎", label: "Weekly Retro" },
  ];

  if (focusMode) {
    return (
      <>
        <style>{styles}</style>
        <FocusMode tasks={tasks} projects={projects} onToggle={toggleTask} onExit={() => setFocusMode(false)} />
        {celebration && <CelebrationModal task={celebration} project={projects.find(p => p.id === celebration.projectId)} onClose={() => setCelebration(null)} />}
      </>
    );
  }

  return (
    <>
      <style>{styles}</style>
      <div className="app">
        <aside className="sidebar">
          <div className="logo">
            <div className="logo-mark">// CRAIZ</div>
            <div className="logo-name">AI Productivity Suite</div>
          </div>
          <nav className="nav">
            {navItems.map((n, i) =>
              n.section ? (
                <div key={i} className="nav-section">{n.section}</div>
              ) : (
                <button key={n.id} className={`nav-btn ${view === n.id ? "active" : ""}`}
                  onClick={() => n.id === "focus" ? setFocusMode(true) : setView(n.id)}>
                  <span className="nav-icon">{n.icon}</span>
                  {n.label}
                  {n.id === "dashboard" && streak > 1 && <span className="streak-pill">🔥{streak}</span>}
                </button>
              )
            )}
          </nav>
          <div style={{ padding: "14px 16px", borderTop: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 8 }}>
            {offline && <div style={{ fontSize: 10, color: "#eab308", fontFamily: "Space Mono, monospace", background: "rgba(234,179,8,0.08)", padding: "4px 8px", borderRadius: 6 }}>● Offline — changes saved locally</div>}
            {syncing && <div style={{ fontSize: 10, color: "var(--accent2)", fontFamily: "Space Mono, monospace" }}>↻ Syncing...</div>}
            {isTrialing && <div style={{ fontSize: 10, color: "var(--accent)", background: "rgba(245,158,11,0.08)", padding: "4px 8px", borderRadius: 6, fontFamily: "Space Mono, monospace" }}>Trial active</div>}
            {!notifEnabled ? (
              <button className="btn-sm" style={{ textAlign: "center", color: "var(--accent2)", borderColor: "rgba(6,182,212,0.3)" }} onClick={enableNotifications}>🔔 Enable Alerts</button>
            ) : (
              <div style={{ fontSize: 10, color: "var(--success)", fontFamily: "Space Mono, monospace" }}>🔔 Alerts on</div>
            )}
            <div style={{ fontSize: 11, color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user?.email}</div>
            <button className="btn-sm danger" onClick={onSignOut} style={{ textAlign: "center" }}>Sign out</button>
          </div>
        </aside>

        <main className="main">
          {view === "dashboard" && (
            <Dashboard projects={projects} tasks={tasks} streak={streak}
              onNewProject={() => setProjModal({})} onNewTask={() => setTaskModal({})}
              onEditProject={p => setProjModal(p)} onDeleteProject={deleteProject}
              onBreakdown={p => setBreakdownProject(p)}
              onFreeze={p => setFreezeModal(p)}
              onThaw={thawProject}
              onLaunchWidget={launchWidget}
              activeWidgetIds={activeWidgets.map(w => w.id)} />
          )}
          {view === "briefing" && <BriefingView tasks={tasks} projects={projects} />}
          {view === "projects" && (
            <ProjectsView projects={projects} tasks={tasks}
              onNew={() => setProjModal({})} onEdit={p => setProjModal(p)}
              onDelete={deleteProject} onBreakdown={p => setBreakdownProject(p)} />
          )}
          {view === "tasks" && (
            <TasksView tasks={tasks} projects={projects}
              onNew={() => setTaskModal({})} onEdit={saveTask}
              onDelete={deleteTask} onToggle={toggleTask} />
          )}
          {view === "timeblock" && <TimeBlockingView tasks={tasks} projects={projects} />}
          {view === "finance" && <FinanceDashboard projects={projects} tasks={tasks} onAddTask={saveTask} onLaunchWidget={launchWidget} activeWidgetIds={activeWidgets.map(w => w.id)} />}
          {view === "planmodel" && <PlanModelShell projects={projects} tasks={tasks} />}
          {view === "retro" && <RetroView tasks={tasks} projects={projects} />}
        </main>
      </div>

      <ChatAssistant projects={projects} tasks={tasks} onAddTasks={bulkAddTasks} />

      {/* ── Floating Widgets (Phase 3 — full content, touch, persisted positions) ── */}
      {activeWidgets.map(w => {
        const def = WIDGET_REGISTRY.find(r => r.id === w.id) || w;
        return (
          <FloatingWidgetV2
            key={w.id} id={w.id} title={def.label} icon={def.icon}
            width={def.width} height={def.height}
            initialPos={getPosition(w.id, def.width)}
            onPositionChange={savePosition}
            onClose={() => closeWidget(w.id)}
          >
            {w.id === "finance-snapshot"  && <WidgetFinanceSnapshot />}
            {w.id === "burnout"            && <WidgetBurnout tasks={tasks} />}
            {w.id === "bills-due"          && <WidgetBillsDue />}
            {w.id === "task-pulse"         && <WidgetTaskPulse tasks={tasks} projects={projects} />}
            {w.id === "ai-warnings"        && (
              <div style={{ padding: 12, fontSize: 12, color: "var(--muted)" }}>
                Open Finance → AI Warnings tab to generate alerts, then float this widget to keep them visible.
              </div>
            )}
            {w.id === "briefing-widget"    && <BriefingMiniWidget tasks={tasks} projects={projects} />}
            {w.id === "plan-model-mini"    && <PlanModelMiniWidget />}
            {w.id === "consulting-room"    && <ConsultingMiniWidget projects={projects} />}
          </FloatingWidgetV2>
        );
      })}

      {projModal !== null && <ProjectModal project={projModal.id ? projModal : null} onSave={saveProject} onClose={() => setProjModal(null)} />}
      {taskModal !== null && <TaskModal task={taskModal.id ? taskModal : null} projects={projects} onSave={saveTask} onClose={() => setTaskModal(null)} />}
      {breakdownProject && <TaskBreakdownModal project={breakdownProject} projects={projects} onAddTasks={addGeneratedTasks} onClose={() => setBreakdownProject(null)} />}
      {celebration && <CelebrationModal task={celebration} project={projects.find(p => p.id === celebration.projectId)} onClose={() => setCelebration(null)} />}
      {freezeModal && <FreezeProjectModal project={freezeModal} onFreeze={data => freezeProject(freezeModal.id, data)} onClose={() => setFreezeModal(null)} />}
    </>
  );
}
