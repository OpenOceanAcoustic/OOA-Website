import { createBrowserRouter } from "react-router-dom";
import { AppShell } from "./shell/AppShell";

export const router = createBrowserRouter([{
  element: <AppShell />,
  children: [
    { path: "/", lazy: async () => ({ Component: (await import("../features/ray-mode/route/RayModeRoute")).RayModeRoute }) },
    { path: "/normal-mode/*", lazy: async () => ({ Component: (await import("../features/normal-mode/route/NormalModeRoute")).NormalModeRoute }) },
    { path: "/pe/*", lazy: async () => ({ Component: (await import("../features/pe/route/PeRoute")).PeRoute }) },
  ],
}]);
