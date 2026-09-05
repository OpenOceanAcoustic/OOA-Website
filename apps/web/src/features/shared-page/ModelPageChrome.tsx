import type { ModelPageName } from "./PageDocument";
import dolphinHeadLogo from "@ooa/assets/brand/dolphin-front-headphones.png";
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

export function ResourceDownload() {
  return (
    <a className="resource-download" title="下载 OOA v1.0.0 Windows x64 EXE 程序与资源（ZIP 压缩包）" href="https://gitee.com/open-ocean/OpenOceanAcoustic/releases/download/v1.0.0/OpenOcean-Windows-x64.zip">
      <span aria-hidden="true">↓</span> 下载 Windows 版 OOA EXE
    </a>
  );
}

export function ModelPageHeader({ activePage }: { readonly activePage: ModelPageName }) {
  return (
    <header className="topbar">
      <a className="brand" href="/" aria-label="OpenOceanAcousticLab 首页">
        <img
          className="brand-logo"
          src={dolphinHeadLogo}
          width="44"
          height="44"
          alt=""
          aria-hidden="true"
        />
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
      <ResourceDownload />
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
      <div className="site-shell"><span>{label}</span><ResourceDownload /><span>NO PARAMETERS ARE UPLOADED</span></div>
    </footer>
  );
}
