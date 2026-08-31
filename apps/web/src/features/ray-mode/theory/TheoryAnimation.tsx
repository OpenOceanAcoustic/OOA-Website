import { Button } from "@ooa/ui";
import { useTheoryAnimation } from "./use-theory-animation";

export function TheoryAnimation() {
  const animation = useTheoryAnimation();
  return <div style={{ display: "grid", gap: ".75rem" }}><canvas ref={animation.canvasRef} role="img" aria-label="局部声速梯度中的射线演示" style={{ width: "100%", height: 180, borderRadius: 12 }} /><Button onClick={animation.toggle}>{animation.running ? "暂停演示" : "继续演示"}</Button></div>;
}
