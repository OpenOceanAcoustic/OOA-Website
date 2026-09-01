import { useEffect } from "react";
import { createPeRuntime } from "@ooa/runtime-pe";
import { ModelPageFooter, ModelPageHeader, RuntimeBanner } from "../../shared-page/ModelPageChrome";
import { PageDocument } from "../../shared-page/PageDocument";
import { PeControls } from "../page/PeControls";
import { PeConvergence } from "../page/PeConvergence";
import { PeDelta } from "../page/PeDelta";
import { PeField } from "../page/PeField";
import { PeHero } from "../page/PeHero";
import { PeMethodNote } from "../page/PeMethodNote";
import { PeProfile } from "../page/PeProfile";
import { mountPePage } from "../controller/page-controller";
import "@ooa/styles/model-lab.css";
import "@ooa/styles/controls.css";
import "../styles/page.css";

export function PeRoute() {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>('[data-ooa-page="pe"]');
    if (root === null) throw new Error("PE page root is missing");
    const runtime = createPeRuntime({
      demonstration: new URLSearchParams(window.location.search).has("demo"),
    });
    const mounted = mountPePage(root, runtime);
    void mounted.ready;
    return () => { void mounted.dispose(); };
  }, []);

  return (
    <PageDocument page="pe" title="OOA PE Method · WebAssembly Lab">
      <ModelPageHeader activePage="pe" />
      <main className="site-shell">
        <PeHero />
        <RuntimeBanner message="正在加载本地 RAM WebAssembly Runtime；输入和结果不会上传到服务器。" />
        <section className="workspace" aria-labelledby="workspaceTitle">
          <div className="workspace-heading">
            <div><p className="micro">02 · WIDE-ANGLE APPROXIMATION</p><h2 id="workspaceTitle">Padé 阶数影响实验台</h2></div>
            <p>同一环境与网格 · 当前 nPade 对比 nPade=10 高阶参考</p>
          </div>
          <div className="pe-grid">
            <PeControls />
            <PeField />
            <PeDelta />
            <PeConvergence />
            <PeProfile />
          </div>
          <PeMethodNote />
        </section>
      </main>
      <ModelPageFooter label="OOA PE Method · browser visualization contract" />
    </PageDocument>
  );
}
