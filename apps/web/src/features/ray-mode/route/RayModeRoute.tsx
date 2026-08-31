import { useEffect } from "react";
import { LegacyDocument } from "../../../app/legacy-document";
import documentSource from "../legacy/index.html?raw";
import "../legacy/page.css";

export function RayModeRoute() {
  useEffect(() => {
    void import("../legacy/controller.js");
  }, []);

  return (
    <LegacyDocument
      documentSource={documentSource}
      page="ray"
      title="OOA-RayMode · 声传播交互实验室"
    />
  );
}
