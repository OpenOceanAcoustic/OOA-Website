import { useEffect } from "react";
import { OriginalPage } from "../../../app/original-page";
import "../../../styles/model-page-theme.css";
import documentSource from "../legacy/index.html?raw";
import "../legacy/page.css";

export function NormalModeRoute() {
  useEffect(() => {
    void import("../legacy/controller.js");
  }, []);

  return (
    <OriginalPage
      documentSource={documentSource}
      page="normal"
      title="OOA Normal Mode · WebAssembly Lab"
    />
  );
}
