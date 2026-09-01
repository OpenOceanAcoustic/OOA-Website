import type { ModelPageName } from "./PageDocument";
import { ModelNavigation } from "@ooa/ui";

const routes: ReadonlyArray<Readonly<{
  page: ModelPageName;
  href: string;
  label: string;
}>> = [
  { page: "ray", href: "/", label: "Ray Mode" },
  { page: "normal", href: "/normal-mode/", label: "Normal Mode" },
  { page: "pe", href: "/pe/", label: "PE Method" },
];

export function ModelPageHeader({ activePage }: { readonly activePage: ModelPageName }) {
  return (
    <header className="site-header">
      <div className="site-shell site-header-inner">
        <a className="brand" href="/" aria-label="返回 OOA Ray Mode">
          <span className="brand-mark" aria-hidden="true"><i></i><i></i><i></i></span>
          <span><strong>OOA-Field</strong><small>CLIENT-SIDE ACOUSTICS</small></span>
        </a>
        <ModelNavigation
          ariaLabel="传播模型"
          items={routes.map((route) => ({
            href: route.href,
            label: route.label,
            active: route.page === activePage,
          }))}
        />
      </div>
    </header>
  );
}

export function RuntimeBanner({
  message,
  mode = "loading",
  badge = "WASM LOADING",
}: {
  readonly message: string;
  readonly mode?: "loading" | "wasm" | "demo" | "error";
  readonly badge?: string;
}) {
  return (
    <div className="runtime-banner" id="runtimeBanner" data-mode={mode} role="status" aria-live="polite">
      <span id="runtimeMessage">{message}</span>
      <b id="runtimeBadge">{badge}</b>
    </div>
  );
}

export function ModelPageFooter({ label }: { readonly label: string }) {
  return (
    <footer className="site-footer">
      <div className="site-shell"><span>{label}</span><span>NO PARAMETERS ARE UPLOADED</span></div>
    </footer>
  );
}
