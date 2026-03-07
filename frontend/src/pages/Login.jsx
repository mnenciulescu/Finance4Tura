import { useState } from "react";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const { signIn, signUp }          = useAuth();
  const [mode, setMode]             = useState("signin"); // "signin" | "signup"
  const [username, setUsername]     = useState("");
  const [password, setPassword]     = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [error, setError]           = useState(null);
  const [success, setSuccess]       = useState(null);
  const [loading, setLoading]       = useState(false);

  const switchMode = (next) => {
    setMode(next);
    setError(null);
    setSuccess(null);
    setUsername("");
    setPassword("");
    setConfirmPass("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (mode === "signup" && password !== confirmPass) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      if (mode === "signin") {
        await signIn(username, password);
      } else {
        await signUp(username, password);
        setSuccess("Account created! You can now sign in.");
        switchMode("signin");
      }
    } catch (err) {
      setError(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={s.root}>
      <form style={s.card} onSubmit={handleSubmit}>
        <div style={s.brand}>Finance4Tura</div>
        <div style={s.subtitle}>{mode === "signin" ? "Sign in to continue" : "Create a new account"}</div>

        {error   && <div style={s.error}>{error}</div>}
        {success && <div style={s.successBox}>{success}</div>}

        <div style={s.field}>
          <label style={s.label}>Username</label>
          <input
            style={s.input}
            type="text"
            value={username}
            onChange={e => setUsername(e.target.value)}
            autoFocus
            autoComplete="username"
            required
          />
        </div>

        <div style={s.field}>
          <label style={s.label}>Password</label>
          <input
            style={s.input}
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
            required
          />
        </div>

        {mode === "signup" && (
          <div style={s.field}>
            <label style={s.label}>Confirm Password</label>
            <input
              style={s.input}
              type="password"
              value={confirmPass}
              onChange={e => setConfirmPass(e.target.value)}
              autoComplete="new-password"
              required
            />
          </div>
        )}

        <button style={{ ...s.btn, opacity: loading ? 0.6 : 1 }} disabled={loading}>
          {loading ? (mode === "signin" ? "Signing in…" : "Creating account…") : (mode === "signin" ? "Sign in" : "Create account")}
        </button>

        <div style={s.switchRow}>
          {mode === "signin" ? (
            <>
              <span style={s.switchText}>Don't have an account?</span>
              <button type="button" style={s.switchBtn} onClick={() => switchMode("signup")}>Create one</button>
            </>
          ) : (
            <>
              <span style={s.switchText}>Already have an account?</span>
              <button type="button" style={s.switchBtn} onClick={() => switchMode("signin")}>Sign in</button>
            </>
          )}
        </div>
      </form>
    </div>
  );
}

const s = {
  root: {
    height:         "100vh",
    display:        "flex",
    alignItems:     "center",
    justifyContent: "center",
    background:     "var(--bg)",
  },
  card: {
    width:         "320px",
    background:    "var(--surface)",
    border:        "1px solid var(--border)",
    borderRadius:  "14px",
    padding:       "32px 28px",
    display:       "flex",
    flexDirection: "column",
    gap:           "18px",
  },
  brand: {
    fontSize:      "18px",
    fontWeight:    700,
    color:         "var(--accent)",
    letterSpacing: "0.02em",
    textAlign:     "center",
  },
  subtitle: {
    fontSize:  "12px",
    color:     "var(--text-muted)",
    textAlign: "center",
    marginTop: "-10px",
  },
  error: {
    background:   "#3b1212",
    border:       "1px solid var(--danger)",
    borderRadius: "8px",
    color:        "#fca5a5",
    fontSize:     "12px",
    padding:      "8px 12px",
  },
  successBox: {
    background:   "#052e16",
    border:       "1px solid #22c55e44",
    borderRadius: "8px",
    color:        "#86efac",
    fontSize:     "12px",
    padding:      "8px 12px",
  },
  field: {
    display:       "flex",
    flexDirection: "column",
    gap:           "5px",
  },
  label: {
    fontSize:      "11px",
    fontWeight:    600,
    color:         "var(--text-muted)",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  },
  input: {
    background:   "var(--surface-2)",
    border:       "1px solid var(--border)",
    borderRadius: "8px",
    color:        "var(--text)",
    fontSize:     "14px",
    padding:      "9px 12px",
    outline:      "none",
    width:        "100%",
    boxSizing:    "border-box",
  },
  btn: {
    background:   "var(--accent)",
    border:       "none",
    borderRadius: "8px",
    color:        "#fff",
    fontSize:     "14px",
    fontWeight:   600,
    padding:      "10px",
    cursor:       "pointer",
    marginTop:    "4px",
  },
  switchRow: {
    display:        "flex",
    justifyContent: "center",
    alignItems:     "center",
    gap:            "6px",
    marginTop:      "-4px",
  },
  switchText: {
    fontSize: "12px",
    color:    "var(--text-muted)",
  },
  switchBtn: {
    background:     "none",
    border:         "none",
    color:          "var(--accent)",
    fontSize:       "12px",
    cursor:         "pointer",
    padding:        0,
    fontWeight:     500,
  },
};
