import { useEffect } from "react";
import { createNormalModeRuntime } from "@ooa/runtime-normal-mode";
import { ModelPageFooter, ModelPageHeader, RuntimeBanner } from "../../shared-page/ModelPageChrome";
import { PageDocument } from "../../shared-page/PageDocument";
import { mountNormalModePage } from "../controller/page-controller";
import { NormalControls } from "../page/NormalControls";
import { NormalDelta } from "../page/NormalDelta";
import { NormalField } from "../page/NormalField";
import { NormalHero } from "../page/NormalHero";
import { NormalMethodNote } from "../page/NormalMethodNote";
import { NormalModeDetail } from "../page/NormalModeDetail";
import { NormalSpectrum } from "../page/NormalSpectrum";
import "@ooa/styles/model-lab.css";
import "@ooa/styles/controls.css";
import "../styles/page.css";

export function NormalModeRoute() {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>('[data-ooa-page="normal"]');
    if (root === null) throw new Error("Normal Mode page root is missing");
    const runtime = createNormalModeRuntime({
      demonstration: new URLSearchParams(window.location.search).has("demo"),
    });
    const mounted = mountNormalModePage(root, runtime);
    void mounted.ready;
    return () => { void mounted.dispose(); };
  }, []);

  return (
    <PageDocument page="normal" title="OOA Normal Mode · WebAssembly Lab">
      <ModelPageHeader activePage="normal" />
      <main className="site-shell">
        <NormalHero />
        <RuntimeBanner message="正在加载本地 Kraken WebAssembly Runtime；输入和结果不会上传到服务器。" />
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
