import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "../lib/supabase";

const LS_PROJECTS = "craiz_offline_projects";
const LS_TASKS    = "craiz_offline_tasks";

export function useData(userId) {
  const [projects, setProjects] = useState([]);
  const [tasks, setTasks]       = useState([]);
  const [syncing, setSyncing]   = useState(false);
  const [offline, setOffline]   = useState(!navigator.onLine);
  const pendingSync             = useRef([]);

  // Track online / offline state
  useEffect(() => {
    const on  = () => { setOffline(false); flushPending(); };
    const off = () => setOffline(true);
    window.addEventListener("online",  on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, [userId]);

  // Initial load
  useEffect(() => {
    if (!userId) return;
    loadData();
  }, [userId]);

  async function loadData() {
    setSyncing(true);
    try {
      const [{ data: p }, { data: t }] = await Promise.all([
        supabase.from("projects").select("*").eq("user_id", userId).order("created_at"),
        supabase.from("tasks").select("*").eq("user_id", userId).order("created_at"),
      ]);
      const proj = (p || []).map(dbToProject);
      const task = (t || []).map(dbToTask);
      setProjects(proj);
      setTasks(task);
      // Cache locally for offline use
      localStorage.setItem(LS_PROJECTS, JSON.stringify(proj));
      localStorage.setItem(LS_TASKS,    JSON.stringify(task));
    } catch {
      // Offline fallback
      const p = localStorage.getItem(LS_PROJECTS);
      const t = localStorage.getItem(LS_TASKS);
      if (p) setProjects(JSON.parse(p));
      if (t) setTasks(JSON.parse(t));
    }
    setSyncing(false);
  }

  // ─── DB shape ↔ App shape converters ───────────────────────────────────────
  function dbToProject(r) {
    return { id: r.id, name: r.name, description: r.description || "", deadline: r.deadline || "", weight: r.weight || 5, createdAt: r.created_at };
  }
  function dbToTask(r) {
    return { id: r.id, projectId: r.project_id, title: r.title, description: r.description || "", priority: r.priority, dueDate: r.due_date || "", status: r.status, effort: r.effort || 0, actual: r.actual || null };
  }
  function projectToDB(p) {
    return { id: p.id, user_id: userId, name: p.name, description: p.description, deadline: p.deadline || null, weight: p.weight };
  }
  function taskToDB(t) {
    return { id: t.id, user_id: userId, project_id: t.projectId, title: t.title, description: t.description, priority: t.priority, due_date: t.dueDate || null, status: t.status, effort: t.effort || null, actual: t.actual || null };
  }

  // ─── Flush pending offline writes ──────────────────────────────────────────
  async function flushPending() {
    if (!pendingSync.current.length) return;
    const ops = [...pendingSync.current];
    pendingSync.current = [];
    for (const op of ops) {
      try { await op(); } catch { /* ignore — will try again */ }
    }
    await loadData();
  }

  function queueOrRun(fn) {
    if (offline) { pendingSync.current.push(fn); }
    else { fn().catch(() => pendingSync.current.push(fn)); }
  }

  // ─── CRUD ─────────────────────────────────────────────────────────────────
  const uid = () => crypto.randomUUID();

  const saveProject = useCallback((form) => {
    const isNew = !form.id;
    const proj = isNew ? { ...form, id: uid() } : { ...form };
    setProjects(ps => isNew ? [...ps, proj] : ps.map(p => p.id === proj.id ? proj : p));
    queueOrRun(() => supabase.from("projects").upsert(projectToDB(proj)));
  }, [userId, offline]);

  const deleteProject = useCallback((id) => {
    setProjects(ps => ps.filter(p => p.id !== id));
    setTasks(ts => ts.filter(t => t.projectId !== id));
    queueOrRun(() => supabase.from("projects").delete().eq("id", id));
    queueOrRun(() => supabase.from("tasks").delete().eq("project_id", id));
  }, [userId, offline]);

  const saveTask = useCallback((form) => {
    const isNew = !form.id;
    const task = isNew ? { ...form, id: uid() } : { ...form };
    setTasks(ts => isNew ? [...ts, task] : ts.map(t => t.id === task.id ? task : t));
    queueOrRun(() => supabase.from("tasks").upsert(taskToDB(task)));
  }, [userId, offline]);

  const deleteTask = useCallback((id) => {
    setTasks(ts => ts.filter(t => t.id !== id));
    queueOrRun(() => supabase.from("tasks").delete().eq("id", id));
  }, [userId, offline]);

  const bulkAddTasks = useCallback((newTasks) => {
    const withIds = newTasks.map(t => ({ ...t, id: t.id || uid() }));
    setTasks(ts => [...ts, ...withIds]);
    queueOrRun(() => supabase.from("tasks").insert(withIds.map(taskToDB)));
  }, [userId, offline]);

  // Persist offline cache whenever state changes
  useEffect(() => {
    localStorage.setItem(LS_PROJECTS, JSON.stringify(projects));
  }, [projects]);
  useEffect(() => {
    localStorage.setItem(LS_TASKS, JSON.stringify(tasks));
  }, [tasks]);

  return { projects, tasks, syncing, offline, saveProject, deleteProject, saveTask, deleteTask, bulkAddTasks, reload: loadData };
}
