import { useEffect } from "react";
import { ModelPageFooter, ModelPageHeader, RuntimeBanner } from "../../shared-page/ModelPageChrome";
import { PageDocument } from "../../shared-page/PageDocument";
import { NormalControls } from "../page/NormalControls";
import { NormalDelta } from "../page/NormalDelta";
import { NormalField } from "../page/NormalField";
import { NormalHero } from "../page/NormalHero";
import { NormalMethodNote } from "../page/NormalMethodNote";
import { NormalModeDetail } from "../page/NormalModeDetail";
import { NormalSpectrum } from "../page/NormalSpectrum";
import "@ooa/styles/model-lab.css";
import "../styles/page.css";

export function NormalModeRoute() {
  useEffect(() => {
    void import("../controller/page-controller.js");
  }, []);

  return (
    <PageDocument page="normal" title="OOA Normal Mode · WebAssembly Lab">
      <ModelPageHeader activePage="normal" />
      <main className="site-shell">
        <NormalHero />
        <RuntimeBanner message="WASM SDK 尚未注册，当前使用浏览器内演示数据；所有图表和交互可用，但数值不可用于工程计算。" />
        <section className="workspace" aria-labelledby="workspaceTitle">
          <div className="workspace-heading">
            <div><p className="micro">01 · MODAL DECOMPOSITION</p><h2 id="workspaceTitle">模态分解实验台</h2></div>
            <p>环境剖面 → 特征值 → 本征函数 → 模态叠加声场</p>
          </div>
          <div className="normal-grid">
            <NormalControls />
            <NormalSpectrum />
            <NormalModeDetail />
            <NormalField />
            <NormalDelta />
          </div>
          <NormalMethodNote />
        </section>
      </main>
      <ModelPageFooter label="OOA Normal Mode · browser visualization contract" />
    </PageDocument>
  );
}
