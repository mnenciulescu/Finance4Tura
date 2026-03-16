import { Component } from "react";

/**
 * Catches unhandled render errors in child components and shows a fallback UI
 * instead of crashing the whole app.  Covers both dark and light themes via
 * CSS variables.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("ErrorBoundary caught:", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={s.wrapper}>
          <div style={s.card}>
            <div style={s.title}>Something went wrong</div>
            <div style={s.message}>{this.state.error.message}</div>
            <button style={s.btn} onClick={() => this.setState({ error: null })}>
              Try again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const s = {
  wrapper: {
    display:        "flex",
    alignItems:     "center",
    justifyContent: "center",
    flex:           1,
    padding:        "40px 24px",
  },
  card: {
    background:   "var(--error-bg)",
    border:       "1px solid var(--danger)",
    borderRadius: "12px",
    padding:      "28px 32px",
    maxWidth:     "480px",
    textAlign:    "center",
  },
  title: {
    fontSize:     "16px",
    fontWeight:   700,
    color:        "var(--error-text)",
    marginBottom: "8px",
  },
  message: {
    fontSize:     "12px",
    color:        "var(--text-muted)",
    marginBottom: "20px",
    fontFamily:   "monospace",
    wordBreak:    "break-word",
  },
  btn: {
    background:   "var(--danger)",
    color:        "#fff",
    border:       "none",
    borderRadius: "8px",
    padding:      "8px 20px",
    cursor:       "pointer",
    fontSize:     "13px",
    fontWeight:   600,
  },
};
