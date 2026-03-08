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

  const handleGoogleSignIn = () => {
    const params = new URLSearchParams({
      identity_provider: "Google",
      redirect_uri:      window.location.origin,
      response_type:     "code",
      client_id:         import.meta.env.VITE_COGNITO_CLIENT_ID,
      scope:             "openid email profile",
    });
    window.location.href = `${import.meta.env.VITE_COGNITO_DOMAIN}/oauth2/authorize?${params}`;
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
        <div style={s.brand}>
          <svg width="44" height="44" viewBox="0 0 34 34" fill="none">
            <circle cx="17" cy="17" r="16" fill="#16a34a"/>
            <rect x="7.5"  y="21" width="4" height="7"  rx="1.5" fill="white" opacity="0.95"/>
            <rect x="15"   y="16" width="4" height="12" rx="1.5" fill="white" opacity="0.95"/>
            <rect x="22.5" y="11" width="4" height="17" rx="1.5" fill="white" opacity="0.95"/>
            <polyline points="9.5,21 17,16 24.5,11" stroke="#86efac" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            <circle cx="9.5"  cy="21" r="2" fill="#86efac"/>
            <circle cx="17"   cy="16" r="2" fill="#86efac"/>
            <circle cx="24.5" cy="11" r="2" fill="#86efac"/>
          </svg>
          <span style={s.brandText}>Finance<span style={s.brandAccent}>4TURA</span></span>
        </div>
        <div style={s.subtitle}>{mode === "signin" ? "Sign in to continue" : "Create a new account"}</div>

        {error   && <div style={s.error}>{error}</div>}
        {success && <div style={s.successBox}>{success}</div>}

        <button type="button" style={s.googleBtn} onClick={handleGoogleSignIn}>
          <svg width="18" height="18" viewBox="0 0 48 48">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
          </svg>
          Continue with Google
        </button>

        <div style={s.divider}>
          <span style={s.dividerLine} />
          <span style={s.dividerText}>or</span>
          <span style={s.dividerLine} />
        </div>

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
    display:        "flex",
    alignItems:     "center",
    justifyContent: "center",
    gap:            "10px",
  },
  brandText: {
    fontSize:   "20px",
    fontWeight: 400,
    color:      "var(--text-muted)",
  },
  brandAccent: {
    fontWeight: 700,
    color:      "var(--badge-text)",
    marginLeft: "2px",
  },
  subtitle: {
    fontSize:  "12px",
    color:     "var(--text-muted)",
    textAlign: "center",
    marginTop: "-10px",
  },
  googleBtn: {
    display:        "flex",
    alignItems:     "center",
    justifyContent: "center",
    gap:            "10px",
    background:     "var(--surface-2)",
    border:         "1px solid var(--border)",
    borderRadius:   "8px",
    color:          "var(--text)",
    fontSize:       "14px",
    fontWeight:     500,
    padding:        "10px",
    cursor:         "pointer",
    width:          "100%",
    transition:     "background 0.15s",
  },
  divider: {
    display:    "flex",
    alignItems: "center",
    gap:        "10px",
  },
  dividerLine: {
    flex:       1,
    height:     "1px",
    background: "var(--border)",
  },
  dividerText: {
    fontSize:  "11px",
    color:     "var(--text-muted)",
    flexShrink: 0,
  },
  error: {
    background:   "var(--error-bg)",
    border:       "1px solid var(--danger)",
    borderRadius: "8px",
    color:        "var(--error-text)",
    fontSize:     "12px",
    padding:      "8px 12px",
  },
  successBox: {
    background:   "var(--success-bg)",
    border:       "1px solid var(--accent)",
    borderRadius: "8px",
    color:        "var(--success-text)",
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
