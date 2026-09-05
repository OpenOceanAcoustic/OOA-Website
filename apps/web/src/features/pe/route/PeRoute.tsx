import { useLayoutEffect, useState } from "react";
import { CollapsibleControls, SectionLinks } from "../../shared-page/WorkspaceNavigation";
import { ModelPageFooter, ModelPageHeader } from "../../shared-page/ModelPageChrome";
import { PageDocument } from "../../shared-page/PageDocument";
import { PeControls } from "../page/PeControls";
import { PeConvergence } from "../page/PeConvergence";
import { PeDelta } from "../page/PeDelta";
import { PeField } from "../page/PeField";
import { PeHero } from "../page/PeHero";
import { PeMethodNote } from "../page/PeMethodNote";
import { PeProfile } from "../page/PeProfile";
import { PeTheorySection } from "../page/PeTheorySection";
import { usePePage } from "../hooks/usePePage";
import "@ooa/styles/model-lab.css";
import "@ooa/styles/controls.css";
import "../styles/page.css";
import "../../shared-page/presentation.css";

export function PeRoute() {
  const page = usePePage({ demonstration: new URLSearchParams(window.location.search).has("demo") });

  const [comparison, setComparison] = useState(() => window.matchMedia("(min-width: 1600px)").matches ? "paired" : "current");
  useLayoutEffect(() => { window.dispatchEvent(new Event("resize")); }, [comparison]);

  return (
    <PageDocument page="pe" title="OOA PE Method · WebAssembly Lab">
      <ModelPageHeader activePage="pe" />
      <main className="site-shell">
        <PeHero page={page} />
        <SectionLinks theoryId="theory" labId="lab" resultsId="results" />
        <PeTheorySection />
        <section id="lab" className="workspace" aria-labelledby="workspaceTitle">
          <div className="workspace-heading">
            <div><p className="micro">02 · WIDE-ANGLE APPROXIMATION</p><h2 id="workspaceTitle">Padé 阶数影响实验台</h2></div>
            <p>同一环境与网格 · 当前 nPade 对比 nPade=10 高阶参考</p>
          </div>
          <div className="pe-grid">
            <CollapsibleControls><PeControls page={page} /></CollapsibleControls>
            <div id="results" className="pe-results-grid" data-view={comparison}>
              <div className="comparison-toolbar">
                <div className="comparison-actions" role="group" aria-label="声场对比视图">
                  {[ ["paired", "双图对照"], ["current", "当前 TL"], ["delta", "误差 ΔTL"] ].map(([value, label]) => <button key={value} type="button" aria-pressed={comparison === value} onClick={() => setComparison(value!)}>{label}</button>)}
                </div>
        <div className="range-control">
          <div className="range-title"><label htmlFor="inspectRange">联动距离 · TL / ΔTL / 垂向剖面</label><output id="inspectRangeOut">{Number(page.parameters.inspectRangeKm).toFixed(1)} km</output></div>
          <input id="inspectRange" type="range" min="0" max={page.result?.parameters.maximumRangeKm ?? 30} step="0.5" value={page.parameters.inspectRangeKm} onInput={(event) => page.setInspectRange(event.currentTarget.value)} />
          <div className="range-ends"><span>近场</span><span>最大距离</span></div>
        </div>
              </div>
              <PeField page={page} />
              <PeDelta page={page} />
              <PeConvergence page={page} />
              <PeProfile page={page} />
            </div>
          </div>
          <PeMethodNote />
        </section>
      </main>
      <ModelPageFooter label="OOA PE Method · browser visualization contract" />
    </PageDocument>
  );
}
