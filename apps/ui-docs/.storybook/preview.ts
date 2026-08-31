import "@ooa/design-tokens/tokens.css";
import type { Preview } from "@storybook/react-vite";
const preview: Preview = { parameters: { backgrounds: { default: "ocean", values: [{ name: "ocean", value: "#07111f" }] }, layout: "centered" } };
export default preview;
