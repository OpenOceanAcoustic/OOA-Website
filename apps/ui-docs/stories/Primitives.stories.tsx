import { Badge, Button, NumberField, RuntimeBanner } from "@ooa/ui";
import type { Meta, StoryObj } from "@storybook/react-vite";
const meta = { title: "OOA/Primitives", component: Button } satisfies Meta<typeof Button>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Buttons: Story = { render: () => <div style={{ display: "grid", gap: 12, minWidth: 320 }}><Button variant="primary">运行计算</Button><Button>取消</Button><Badge>WASM · local</Badge><RuntimeBanner state="ready" detail="Worker 与本地包已就绪" /><NumberField label="频率 / Hz" value={50} onValueChange={() => undefined} /></div> };
