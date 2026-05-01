import React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallbackTitle?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[Meshlink Error]", error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center p-6 gap-3 h-full min-h-[120px]">
          <AlertTriangle className="h-8 w-8 text-destructive/60" />
          <p className="text-sm font-medium text-foreground">{this.props.fallbackTitle || "Something went wrong"}</p>
          <p className="text-[11px] text-muted-foreground text-center max-w-xs">
            {this.state.error?.message || "An unexpected error occurred"}
          </p>
          <button
            onClick={this.handleReset}
            className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-medium gradient-primary text-primary-foreground shadow-glow hover:scale-[1.02] transition-all"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

/** Lightweight inline error boundary for small UI sections */
export class InlineErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error("[Meshlink Component Error]", error.message);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="text-[10px] text-muted-foreground/50 p-2 text-center">
          <button onClick={() => this.setState({ hasError: false })} className="hover:text-primary">
            ⚠ Error — tap to retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
