import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary] Caught error:', error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="h-full flex flex-col items-center justify-center bg-black p-8">
          <div className="border border-border bg-panel p-8 max-w-md w-full text-center space-y-4">
            <AlertTriangle className="w-10 h-10 text-bearish mx-auto" />
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
              System Error
            </h2>
            <p className="text-[11px] font-mono text-neutral leading-relaxed">
              An unexpected error occurred. This has been logged.
            </p>
            {this.state.error && (
              <pre className="text-[9px] font-mono text-bearish/70 bg-black border border-border p-3 text-left overflow-auto max-h-32">
                {this.state.error.message}
              </pre>
            )}
            <button
              onClick={this.handleReset}
              className="inline-flex items-center gap-2 px-4 py-2 bg-accent text-black text-xs font-bold uppercase tracking-wider hover:brightness-110 transition-none"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Recover
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/** Lighter error boundary for individual panels */
export class PanelErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[PanelError]', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-full flex items-center justify-center bg-black/50 p-4">
          <div className="text-center space-y-2">
            <AlertTriangle className="w-5 h-5 text-bearish mx-auto" />
            <p className="text-[10px] font-mono text-neutral uppercase tracking-wider">
              Panel failed to load
            </p>
            <button
              onClick={() => this.setState({ hasError: false })}
              className="text-[9px] font-mono text-accent hover:underline uppercase"
            >
              Retry
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
