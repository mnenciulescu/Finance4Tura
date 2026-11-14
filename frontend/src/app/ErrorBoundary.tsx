import { Component, type ErrorInfo, type ReactNode } from "react";
import { EmptyState } from "../ui/Display";
import { Button } from "../ui/Button";

interface State { error: Error | null; }

/** Catches render errors in a screen and offers a retry instead of a blank app. */
export class ErrorBoundary extends Component<{ children: ReactNode; resetKey?: string }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Render error:", error, info.componentStack);
  }

  componentDidUpdate(prev: { resetKey?: string }) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null });
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div style={{ paddingTop: "calc(env(safe-area-inset-top) + 60px)" }}>
        <EmptyState
          icon="warning"
          title="Something went wrong"
          message={this.state.error.message || "This screen could not be shown."}
          action={<Button variant="tinted" onClick={() => this.setState({ error: null })}>Try Again</Button>}
        />
      </div>
    );
  }
}
