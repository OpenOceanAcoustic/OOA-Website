import { useRef } from "react";
import { PageDocument } from "../../shared-page/PageDocument";
import { RayEigenrayLab } from "../page/RayEigenrayLab";
import { RayFieldLab } from "../page/RayFieldLab";
import { RayFooter } from "../page/RayFooter";
import { RayHeader } from "../page/RayHeader";
import { RayLabIntroduction } from "../page/RayLabIntroduction";
import { RayTheorySection } from "../page/RayTheorySection";
import { useRayPage } from "../hooks/useRayPage";
import "../styles/page.css";

export function RayModeRoute() {
  const root = useRef<HTMLDivElement>(null);
  useRayPage(root, new URLSearchParams(window.location.search).has("demo"));

  return (
    <PageDocument page="ray" title="OOA-RayMode · 声传播交互实验室" rootRef={root}>
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
