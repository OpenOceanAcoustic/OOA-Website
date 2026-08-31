import { useEffect } from "react";
import { ModelPageFooter, ModelPageHeader, RuntimeBanner } from "../../shared-page/ModelPageChrome";
import { PageDocument } from "../../shared-page/PageDocument";
import { PeControls } from "../page/PeControls";
import { PeConvergence } from "../page/PeConvergence";
import { PeDelta } from "../page/PeDelta";
import { PeField } from "../page/PeField";
import { PeHero } from "../page/PeHero";
import { PeMethodNote } from "../page/PeMethodNote";
import { PeProfile } from "../page/PeProfile";
import "@ooa/styles/model-lab.css";
import "../styles/page.css";

export function PeRoute() {
  useEffect(() => {
    void import("../controller/page-controller.js");
  }, []);

  return (
    <PageDocument page="pe" title="OOA PE Method · WebAssembly Lab">
      <ModelPageHeader activePage="pe" />
      <main className="site-shell">
        <PeHero />
        <RuntimeBanner message="WASM SDK 尚未注册，当前使用浏览器内演示数据；图表用于验证交互，不代表 RAM 数值结果。" />
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
