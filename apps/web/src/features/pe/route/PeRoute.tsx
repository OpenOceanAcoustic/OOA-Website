import { ModelPageFooter, ModelPageHeader, RuntimeBanner } from "../../shared-page/ModelPageChrome";
import { PageDocument } from "../../shared-page/PageDocument";
import { PeControls } from "../page/PeControls";
import { PeConvergence } from "../page/PeConvergence";
import { PeDelta } from "../page/PeDelta";
import { PeField } from "../page/PeField";
import { PeHero } from "../page/PeHero";
import { PeMethodNote } from "../page/PeMethodNote";
import { PeProfile } from "../page/PeProfile";
import { usePePage } from "../hooks/usePePage";
import "@ooa/styles/model-lab.css";
import "@ooa/styles/controls.css";
import "../styles/page.css";

export function PeRoute() {
  const page = usePePage({ demonstration: new URLSearchParams(window.location.search).has("demo") });

  return (
    <PageDocument page="pe" title="OOA PE Method · WebAssembly Lab">
      <ModelPageHeader activePage="pe" />
      <main className="site-shell">
        <PeHero page={page} />
        <RuntimeBanner message={page.runtimeView.message} mode={page.runtimeView.mode} badge={page.runtimeView.badge} />
        <section className="workspace" aria-labelledby="workspaceTitle">
          <div className="workspace-heading">
            <div><p className="micro">02 · WIDE-ANGLE APPROXIMATION</p><h2 id="workspaceTitle">Padé 阶数影响实验台</h2></div>
            <p>同一环境与网格 · 当前 nPade 对比 nPade=10 高阶参考</p>
          </div>
          <div className="pe-grid">
            <PeControls page={page} />
            <PeField page={page} />
            <PeDelta page={page} />
            <PeConvergence page={page} />
            <PeProfile page={page} />
          </div>
          <PeMethodNote />
        </section>
      </main>
      <ModelPageFooter label="OOA PE Method · browser visualization contract" />
    </PageDocument>
  );
}
