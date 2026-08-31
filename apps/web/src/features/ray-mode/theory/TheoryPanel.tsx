import { Panel } from "@ooa/ui";
import { TheoryAnimation } from "./TheoryAnimation";
export function TheoryPanel() { return <Panel title="射线理论" description="高频近似、程函方程与几何扩散"><p>Bellhop2D 沿局部声速梯度积分射线路径，并以边界反射、焦散修正和束宽模型合成接收场。</p><p><code>|∇T| = 1 / c(r,z)</code> 描述走时程函；声线方向沿 <code>∇T</code> 演化。主声场与本征声线共用同一环境，但属于独立任务与最后结果。</p><TheoryAnimation /></Panel>; }
