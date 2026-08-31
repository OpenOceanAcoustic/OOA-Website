import { useEffect, useRef, useState } from "react";

export function useTheoryAnimation() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [running, setRunning] = useState(false);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas === null) return undefined;
    let frame = 0;
    let animation = 0;
    const render = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.max(1, window.devicePixelRatio || 1);
      const width = Math.max(1, Math.round(rect.width * dpr));
      const height = Math.max(1, Math.round(rect.height * dpr));
      if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
      const context = canvas.getContext("2d");
      if (context === null) return;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      context.clearRect(0, 0, rect.width, rect.height);
      const gradient = context.createLinearGradient(0, 0, 0, rect.height);
      gradient.addColorStop(0, "#071b31"); gradient.addColorStop(1, "#0d3450");
      context.fillStyle = gradient; context.fillRect(0, 0, rect.width, rect.height);
      for (let ray = -2; ray <= 2; ray += 1) {
        context.beginPath(); context.strokeStyle = ray === 0 ? "#ffc861" : "#32d5ff"; context.globalAlpha = ray === 0 ? 1 : .55;
        for (let x = 0; x <= rect.width; x += 4) {
          const phase = x / Math.max(1, rect.width) * Math.PI * 2 + frame * .025;
          const y = rect.height / 2 + ray * 15 + Math.sin(phase + ray * .35) * (10 + Math.abs(ray) * 2);
          if (x === 0) context.moveTo(x, y); else context.lineTo(x, y);
        }
        context.stroke();
      }
      context.globalAlpha = 1;
      frame += 1;
      if (running) animation = requestAnimationFrame(render);
    };
    render();
    return () => cancelAnimationFrame(animation);
  }, [running]);
  return { canvasRef, running, toggle: () => setRunning((value) => !value) };
}
