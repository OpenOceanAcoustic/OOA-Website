import { Component, type ErrorInfo, type ReactNode } from "react";
import { ErrorState } from "@ooa/ui";

export class AppErrorBoundary extends Component<{ readonly children: ReactNode }, { readonly error: Error | null }> {
  override state = { error: null } as { readonly error: Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  override componentDidCatch(error: Error, info: ErrorInfo): void { console.error("OOA application error", error, info); }
  override render() { return this.state.error === null ? this.props.children : <ErrorState message={this.state.error.message} />; }
}
