import { Component, type ErrorInfo, type ReactNode } from "react";

export class AppErrorBoundary extends Component<{ readonly children: ReactNode }, { readonly error: Error | null }> {
  override state = { error: null } as { readonly error: Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  override componentDidCatch(error: Error, info: ErrorInfo): void { console.error("OOA application error", error, info); }
  override render() {
    return this.state.error === null ? this.props.children : (
      <section className="ooa-app-error" role="alert">
        <h1>页面运行失败</h1>
        <p>{this.state.error.message}</p>
      </section>
    );
  }
}
