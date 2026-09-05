import { ModelPageFooter, ModelPageHeader } from "../../shared-page/ModelPageChrome";
import { PageDocument } from "../../shared-page/PageDocument";
import { useNormalModePage } from "../hooks/useNormalModePage";
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
  const page = useNormalModePage({
    demonstration: new URLSearchParams(window.location.search).has("demo"),
  });

  return (
    <PageDocument page="normal" title="OOA Normal Mode · WebAssembly Lab">
      <ModelPageHeader activePage="normal" />
      <main className="site-shell">
        <NormalHero page={page} />
        <section className="workspace" aria-labelledby="workspaceTitle">
          <div className="workspace-heading">
            <div><p className="micro">01 · MODAL DECOMPOSITION</p><h2 id="workspaceTitle">模态分解实验台</h2></div>
            <p>环境剖面 → 特征值 → 本征函数 → 模态叠加声场</p>
          </div>
          <div className="normal-grid">
            <NormalControls page={page} />
            <div className="normal-results-grid">
              <NormalSpectrum page={page} />
              <NormalModeDetail page={page} />
              <NormalField page={page} />
              <NormalDelta page={page} />
            </div>
          </div>
          <NormalMethodNote />
        </section>
      </main>
      <ModelPageFooter label="OOA Normal Mode · browser visualization contract" />
    </PageDocument>
  );
}
