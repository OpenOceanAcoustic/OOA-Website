import { useEffect } from "react";
import { LegacyDocument } from "../../../app/legacy-document";
import "../../../styles/model-page-theme.css";
import documentSource from "../legacy/index.html?raw";
import "../legacy/page.css";

export function NormalModeRoute() {
  useEffect(() => {
    void import("../legacy/controller.js");
  }, []);

  return (
    <LegacyDocument
      documentSource={documentSource}
      page="normal"
      title="OOA Normal Mode · WebAssembly Lab"
    />
  );
}
