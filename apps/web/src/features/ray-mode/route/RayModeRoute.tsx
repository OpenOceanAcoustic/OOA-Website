import { useEffect } from "react";
import { PageDocument } from "../../shared-page/PageDocument";
import { RayEigenrayLab } from "../page/RayEigenrayLab";
import { RayFieldLab } from "../page/RayFieldLab";
import { RayFooter } from "../page/RayFooter";
import { RayHeader } from "../page/RayHeader";
import { RayLabIntroduction } from "../page/RayLabIntroduction";
import { RayTheorySection } from "../page/RayTheorySection";
import "../styles/page.css";

export function RayModeRoute() {
  useEffect(() => {
    void import("../controller/page-controller.js");
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
