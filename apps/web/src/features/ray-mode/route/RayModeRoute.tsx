import { useEffect } from "react";
import { createRayRuntime } from "@ooa/runtime-ray";
import { PageDocument } from "../../shared-page/PageDocument";
import { RayEigenrayLab } from "../page/RayEigenrayLab";
import { RayFieldLab } from "../page/RayFieldLab";
import { RayFooter } from "../page/RayFooter";
import { RayHeader } from "../page/RayHeader";
import { RayLabIntroduction } from "../page/RayLabIntroduction";
import { RayTheorySection } from "../page/RayTheorySection";
import { mountRayPage } from "../controller/page-controller";
import "../styles/page.css";

export function RayModeRoute() {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>('[data-ooa-page="ray"]');
    if (root === null) throw new Error("Ray Mode page root is missing");
    const runtime = createRayRuntime({
      demonstration: new URLSearchParams(window.location.search).has("demo"),
    });
    const mounted = mountRayPage(root, runtime);
    void mounted.ready;
    return () => { void mounted.dispose(); };
  }, []);

  return (
    <PageDocument page="ray" title="OOA-RayMode · 声传播交互实验室">
      <RayHeader />
      <main id="top">
        <RayTheorySection />
        <RayLabIntroduction />
        <RayFieldLab />
        <RayEigenrayLab />
      </main>
      <RayFooter />
    </PageDocument>
  );
}
