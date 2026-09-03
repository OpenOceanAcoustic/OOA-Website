import type { ModelPageName } from "./PageDocument";
import { ModelNavigation } from "@ooa/ui";
import "./model-page-header.css";

const routes: ReadonlyArray<Readonly<{
  page: ModelPageName;
  href: string;
  label: string;
}>> = [
  { page: "ray", href: "/", label: "Ray Mode" },
  { page: "normal", href: "/normal-mode/", label: "Normal Mode" },
  { page: "pe", href: "/pe/", label: "PE" },
];

export function ModelPageHeader({ activePage }: { readonly activePage: ModelPageName }) {
  return (
    <header className="topbar">
      <a className="brand" href="/" aria-label="OpenOceanAcousticLab 首页">
        <span className="brand-mark" aria-hidden="true"><i></i><i></i><i></i></span>
        <span><strong>OpenOceanAcousticLab</strong><small>ACOUSTIC PROPAGATION LAB</small></span>
      </a>
      <ModelNavigation
        ariaLabel="主导航"
        items={routes.map((route) => ({
          href: route.href,
          label: route.label,
          active: route.page === activePage,
        }))}
      />
      <div className="status">
        <span aria-hidden="true"></span>
        OOA LAB <b>READY</b>
      </div>
    </header>
  );
}

export function ModelPageFooter({ label }: { readonly label: string }) {
  return (
    <footer className="site-footer">
      <div className="site-shell"><span>{label}</span><span>NO PARAMETERS ARE UPLOADED</span></div>
    </footer>
  );
}
