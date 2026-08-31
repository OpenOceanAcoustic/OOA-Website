import { useEffect } from "react";
import { OriginalPage } from "../../../app/original-page";
import documentSource from "../legacy/index.html?raw";
import "../legacy/page.css";

export function RayModeRoute() {
  useEffect(() => {
    void import("../legacy/controller.js");
  }, []);

  return (
    <OriginalPage
      documentSource={documentSource}
      page="ray"
      title="OOA-RayMode · 声传播交互实验室"
    />
  );
}
