import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RotateCcw, ShieldAlert } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in NMDC Dispatch Console:', error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleReset = () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {
      // ignore
    }
    window.location.href = window.location.pathname;
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0A0A0B] text-slate-100 flex items-center justify-center p-6 font-sans">
          <div className="max-w-lg w-full bg-[#111114] border-2 border-red-500/60 p-6 flex flex-col gap-5 shadow-2xl">
            <div className="flex items-center gap-3 border-b border-red-500/30 pb-4">
              <div className="p-2.5 bg-red-950/80 border border-red-500 rounded-xs text-red-400">
                <ShieldAlert className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <h1 className="font-mono text-sm font-bold text-red-400 uppercase tracking-wider">
                  NMDC Central &bull; Telemetry Fault Recovery
                </h1>
                <p className="font-mono text-xs text-slate-400">
                  Sector 14-A / Bailadila Haul Dispatch
                </p>
              </div>
            </div>

            <div className="bg-[#070708] border border-red-500/30 p-3.5 flex flex-col gap-2">
              <div className="flex items-center gap-2 text-xs font-mono font-bold text-red-400">
                <AlertTriangle className="w-4 h-4 text-red-400" />
                <span>FAULT DETECTED DURING RUNTIME</span>
              </div>
              <p className="font-mono text-xs text-slate-300 break-words leading-relaxed">
                {this.state.error?.message || 'An unexpected rendering error interrupted the dispatch stream.'}
              </p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={this.handleReload}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-600 hover:bg-amber-500 text-white font-mono text-xs font-bold uppercase tracking-wider border border-amber-400 cursor-pointer transition-all shadow-md"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Reload Dispatch Console</span>
              </button>
              <button
                type="button"
                onClick={this.handleReset}
                className="px-4 py-2.5 bg-[#18181b] hover:bg-[#27272a] text-slate-300 hover:text-white font-mono text-xs font-semibold uppercase tracking-wider border border-slate-700 cursor-pointer transition-all"
              >
                Clear State
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
