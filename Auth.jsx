import { useState } from "react";

const s = {
  overlay: { minHeight:"100vh",background:"#0c0f14",display:"flex",alignItems:"center",justifyContent:"center",padding:"20px",fontFamily:"'DM Sans',sans-serif" },
  card: { background:"#131820",border:"1px solid rgba(255,255,255,0.07)",borderRadius:"20px",padding:"40px",width:"100%",maxWidth:"420px" },
  logo: { textAlign:"center",marginBottom:"32px" },
  logoMark: { fontFamily:"'Space Mono',monospace",fontSize:"10px",color:"#f59e0b",letterSpacing:"3px" },
  logoName: { fontSize:"20px",fontWeight:"700",color:"#e2e8f0",marginTop:"4px" },
  title: { fontSize:"22px",fontWeight:"700",color:"#e2e8f0",marginBottom:"6px",textAlign:"center" },
  sub: { fontSize:"14px",color:"#64748b",textAlign:"center",marginBottom:"28px" },
  group: { marginBottom:"16px" },
  label: { display:"block",fontSize:"11px",textTransform:"uppercase",letterSpacing:"1.5px",color:"#64748b",marginBottom:"6px" },
  input: { width:"100%",background:"#1a2230",border:"1px solid rgba(255,255,255,0.07)",borderRadius:"8px",color:"#e2e8f0",padding:"11px 14px",fontSize:"14px",fontFamily:"'DM Sans',sans-serif",outline:"none",transition:"border-color 0.15s" },
  btn: { width:"100%",background:"#f59e0b",color:"#000",border:"none",borderRadius:"10px",padding:"13px",fontSize:"14px",fontWeight:"700",fontFamily:"'DM Sans',sans-serif",cursor:"pointer",marginTop:"4px",transition:"background 0.15s" },
  link: { color:"#f59e0b",cursor:"pointer",textDecoration:"none",fontWeight:"600" },
  error: { background:"rgba(239,68,68,0.1)",border:"1px solid rgba(239,68,68,0.3)",borderRadius:"8px",padding:"10px 14px",fontSize:"13px",color:"#ef4444",marginBottom:"16px" },
  success: { background:"rgba(34,197,94,0.1)",border:"1px solid rgba(34,197,94,0.3)",borderRadius:"8px",padding:"10px 14px",fontSize:"13px",color:"#22c55e",marginBottom:"16px" },
  divider: { display:"flex",alignItems:"center",gap:"12px",margin:"20px 0",color:"#64748b",fontSize:"12px" },
  divLine: { flex:1,height:"1px",background:"rgba(255,255,255,0.07)" },
};

export default function Auth({ onBack, signUp, signIn }) {
  const [mode, setMode] = useState("signup"); // signup | login | reset
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async () => {
    setError(""); setSuccess("");
    if (!form.email || (!form.password && mode !== "reset")) { setError("Please fill in all fields."); return; }
    setLoading(true);

    if (mode === "signup") {
      if (!form.name) { setError("Please enter your name."); setLoading(false); return; }
      if (form.password.length < 8) { setError("Password must be at least 8 characters."); setLoading(false); return; }
      const { error: e } = await signUp(form.email, form.password, form.name);
      if (e) setError(e.message);
      else setSuccess("Check your email to confirm your account, then come back to log in.");
    } else if (mode === "login") {
      const { error: e } = await signIn(form.email, form.password);
      if (e) setError("Invalid email or password.");
    } else if (mode === "reset") {
      // handled by useAuth.resetPassword — simplified here
      setSuccess("If that email exists, you'll get a reset link shortly.");
    }
    setLoading(false);
  };

  return (
    <div style={s.overlay}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=DM+Sans:wght@300;400;500;600&display=swap');input:focus{border-color:#f59e0b!important;}input::placeholder{color:#475569;}`}</style>
      <div style={s.card}>
        <div style={s.logo}>
          <div style={s.logoMark}>// CRAIZ</div>
          <div style={s.logoName}>AI Task Planner</div>
        </div>

        {mode === "signup" && <>
          <div style={s.title}>Start your free trial</div>
          <div style={s.sub}>7 days free · No credit card required</div>
        </>}
        {mode === "login" && <>
          <div style={s.title}>Welcome back</div>
          <div style={s.sub}>Log in to your Craiz account</div>
        </>}
        {mode === "reset" && <>
          <div style={s.title}>Reset password</div>
          <div style={s.sub}>We'll send you a reset link</div>
        </>}

        {error && <div style={s.error}>{error}</div>}
        {success && <div style={s.success}>{success}</div>}

        {mode === "signup" && (
          <div style={s.group}>
            <label style={s.label}>Your Name</label>
            <input style={s.input} value={form.name} onChange={set("name")} placeholder="Jane Smith" autoComplete="name" />
          </div>
        )}
        <div style={s.group}>
          <label style={s.label}>Email</label>
          <input style={s.input} type="email" value={form.email} onChange={set("email")} placeholder="you@example.com" autoComplete="email" onKeyDown={e => e.key === "Enter" && handleSubmit()} />
        </div>
        {mode !== "reset" && (
          <div style={s.group}>
            <label style={s.label}>Password{mode === "signup" ? " (min 8 characters)" : ""}</label>
            <input style={s.input} type="password" value={form.password} onChange={set("password")} placeholder="••••••••" autoComplete={mode === "signup" ? "new-password" : "current-password"} onKeyDown={e => e.key === "Enter" && handleSubmit()} />
          </div>
        )}

        <button style={s.btn} onClick={handleSubmit} disabled={loading} onMouseOver={e => e.target.style.background="#fbbf24"} onMouseOut={e => e.target.style.background="#f59e0b"}>
          {loading ? "..." : mode === "signup" ? "Create Account & Start Trial" : mode === "login" ? "Log In" : "Send Reset Link"}
        </button>

        <div style={s.divider}><div style={s.divLine} /><span>or</span><div style={s.divLine} /></div>

        <div style={{ textAlign: "center", fontSize: 14, color: "#64748b", lineHeight: 2 }}>
          {mode === "signup" && <>Already have an account? <span style={s.link} onClick={() => { setMode("login"); setError(""); setSuccess(""); }}>Log in</span></>}
          {mode === "login" && <>
            Don't have an account? <span style={s.link} onClick={() => { setMode("signup"); setError(""); setSuccess(""); }}>Sign up free</span>
            <br />
            <span style={s.link} onClick={() => { setMode("reset"); setError(""); setSuccess(""); }}>Forgot password?</span>
          </>}
          {mode === "reset" && <span style={s.link} onClick={() => { setMode("login"); setError(""); setSuccess(""); }}>Back to login</span>}
        </div>

        {onBack && (
          <div style={{ textAlign: "center", marginTop: 20 }}>
            <span style={{ color: "#475569", fontSize: 13, cursor: "pointer" }} onClick={onBack}>← Back to home</span>
          </div>
        )}
      </div>
    </div>
  );
}
