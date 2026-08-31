import "@ooa/design-tokens/tokens.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { AppErrorBoundary } from "./error-boundary";
import { AppProviders } from "./providers";
import { router } from "./router";
import "../styles/global.css";

const root = document.getElementById("root");
if (root === null) throw new Error("Missing #root element");
createRoot(root).render(<StrictMode><AppErrorBoundary><AppProviders><RouterProvider router={router} /></AppProviders></AppErrorBoundary></StrictMode>);
