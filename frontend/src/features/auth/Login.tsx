import { useEffect, useRef, useState, type FormEvent } from "react";
import { useAuth } from "../../context/AuthContext";
import { useAppSettings } from "../../context/AppSettingsContext";
import { useTheme } from "../../theme/ThemeProvider";
import { Button, Icon, Notice } from "../../ui";
import s from "./Login.module.css";

declare global {
  interface Window { google?: any; }
}

function PasswordInput({
  value, onChange, placeholder, autoComplete, label,
}: { value: string; onChange: (v: string) => void; placeholder: string; autoComplete: string; label: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className={s.row}>
      <input
        className={s.input}
        type={show ? "text" : "password"}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={label}
        autoComplete={autoComplete}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        required
      />
      <button
        type="button"
        className={s.eye}
        onClick={() => setShow(v => !v)}
        aria-label={show ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
        aria-pressed={show}
      >
        <Icon name={show ? "eyeSlash" : "eye"} size={20} />
      </button>
    </div>
  );
}

/** Login (proposal §8.1): same logic, iOS look. */
export default function Login() {
  const { signIn, signUp, signInWithGoogle } = useAuth();
  const { settings } = useAppSettings();
  const { theme } = useTheme();
  const [modeState, setMode] = useState<"signin" | "signup">("signin");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const googleRef = useRef<HTMLDivElement>(null);
  const { googleLoginEnabled, createAccountEnabled } = settings;
  // Create account switched off while on the sign-up form: show sign-in.
  const mode = createAccountEnabled ? modeState : "signin";

  const switchMode = (next: "signin" | "signup") => {
    setMode(next);
    setError(null);
    setSuccess(null);
    setUsername("");
    setPassword("");
    setConfirm("");
  };

  const onGoogle = async (response: { credential: string }) => {
    setError(null);
    setLoading(true);
    try {
      await signInWithGoogle(response.credential);
      window.history.replaceState({}, "", "/");
    } catch (err: any) {
      setError(err?.message || "Google sign-in failed.");
      setLoading(false);
    }
  };

  // Google Identity Services renders its own button (branding rules); its
  // theme follows the app's.
  useEffect(() => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId || !googleLoginEnabled) return;
    const init = () => {
      window.google.accounts.id.initialize({ client_id: clientId, callback: onGoogle, ux_mode: "popup" });
      if (googleRef.current) {
        googleRef.current.innerHTML = "";
        window.google.accounts.id.renderButton(googleRef.current, {
          theme: theme === "dark" ? "filled_black" : "outline",
          size: "large",
          shape: "pill",
          width: 300,
          text: "continue_with",
        });
      }
    };
    if (window.google?.accounts?.id) init();
    else {
      const script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      script.onload = init;
      document.head.appendChild(script);
    }
  }, [googleLoginEnabled, theme]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (mode === "signup" && password !== confirm) { setError("Passwords do not match."); return; }
    setLoading(true);
    try {
      if (mode === "signin") {
        await signIn(username, password);
        window.history.replaceState({}, "", "/");
      } else {
        await signUp(username, password);
        switchMode("signin");
        setSuccess("Account created! You can now sign in.");
        setLoading(false);
      }
    } catch (err: any) {
      setError(err?.message || "Something went wrong.");
      setLoading(false);
    }
  };

  return (
    <main className={s.screen}>
      <div className={s.column}>
        <img src="/app-icon.svg" alt="" className={s.icon} width={80} height={80} />
        <h1 className={s.title}>4TURA Home</h1>
        <p className={s.subtitle}>{mode === "signin" ? "Sign in to continue" : "Create your account"}</p>

        {error && <Notice>{error}</Notice>}
        {success && <Notice tone="info">{success}</Notice>}

        <form className={s.form} onSubmit={submit}>
          <div className={s.group}>
            <div className={s.row}>
              <input
                className={s.input}
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="Username"
                aria-label="Username"
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint="next"
                autoFocus
                required
              />
            </div>
            <PasswordInput
              value={password}
              onChange={setPassword}
              placeholder="Password"
              label="Password"
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
            />
            {mode === "signup" && (
              <PasswordInput value={confirm} onChange={setConfirm} placeholder="Confirm password" label="Confirm password" autoComplete="new-password" />
            )}
          </div>
          <Button type="submit" variant="filled" size="large" block loading={loading}>
            {mode === "signin" ? "Sign In" : "Create Account"}
          </Button>
        </form>

        {googleLoginEnabled && (
          <>
            <div className={s.or}><span>or</span></div>
            <div ref={googleRef} className={s.google} />
          </>
        )}

        {createAccountEnabled && (
          <p className={s.switch}>
            {mode === "signin" ? (
              <>Don't have an account? <button type="button" onClick={() => switchMode("signup")}>Create one</button></>
            ) : (
              <>Already have an account? <button type="button" onClick={() => switchMode("signin")}>Sign in</button></>
            )}
          </p>
        )}
      </div>
    </main>
  );
}
