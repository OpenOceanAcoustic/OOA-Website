import { Panel } from "@ooa/ui";
export function VelocityPanel() { return <Panel title="粒子振速" description="与压力结果保持独立视图"><p>振速输出由 Bellhop2D 的 velocity 选项控制。当前首期 runtime 保持压力场的最小稳定接口，后续可在不改 feature 状态边界的情况下扩展水平/垂向分量。</p></Panel>; }
