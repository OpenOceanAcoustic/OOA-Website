const CYAN = "#62d8e7";
const AMBER = "#ffb64a";
const TEXT = "#71949e";
const GRID = "rgba(220, 242, 244, 0.34)";

function prepareCanvas(canvas: HTMLCanvasElement) {
  const rectangle = canvas.getBoundingClientRect();
  const width = Math.round(rectangle.width);
  const height = Math.round(rectangle.height);
  if (width < 2 || height < 2) return null;

  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  const targetWidth = Math.round(width * pixelRatio);
  const targetHeight = Math.round(height * pixelRatio);
  if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
    canvas.width = targetWidth;
    canvas.height = targetHeight;
  }
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  context.clearRect(0, 0, width, height);
  context.fillStyle = "#041720";
  context.fillRect(0, 0, width, height);
  context.lineCap = "round";
  context.lineJoin = "round";
  return { context, width, height };
}

function label(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  alignment: CanvasTextAlign = "center",
  color = TEXT,
  fontSize = 11,
) {
  context.fillStyle = color;
  context.font = `${fontSize}px ui-monospace, SFMono-Regular, Menlo, monospace`;
  context.textAlign = alignment;
  context.fillText(text, x, y);
}

function interpolate(from: number, to: number, amount: number) {
  return Math.round(from + (to - from) * amount);
}

function tlColor(normalizedTl: number) {
  const stops: ReadonlyArray<readonly [number, readonly [number, number, number]]> = [
    [0, [190, 28, 38]],
    [0.22, [239, 116, 42]],
    [0.42, [230, 213, 58]],
    [0.61, [92, 190, 101]],
    [0.79, [40, 177, 177]],
    [1, [34, 82, 164]],
  ];
  const value = Math.max(0, Math.min(normalizedTl, 1));
  const upperIndex = stops.findIndex(([position]) => position >= value);
  const upper = stops[Math.max(upperIndex, 1)] ?? stops[stops.length - 1]!;
  const lower = stops[Math.max(upperIndex - 1, 0)] ?? stops[0]!;
  const amount = (value - lower[0]) / Math.max(upper[0] - lower[0], 1e-6);
  return `rgb(${interpolate(lower[1][0], upper[1][0], amount)}, ${interpolate(lower[1][1], upper[1][1], amount)}, ${interpolate(lower[1][2], upper[1][2], amount)})`;
}

function roundedBox(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  stroke: string,
  fill: string,
) {
  context.beginPath();
  context.roundRect(x, y, width, height, 5);
  context.fillStyle = fill;
  context.fill();
  context.strokeStyle = stroke;
  context.stroke();
}

export function renderPeMarch(canvas: HTMLCanvasElement, progress: number) {
  const prepared = prepareCanvas(canvas);
  if (!prepared) return;
  const { context, width, height } = prepared;
  const compact = width < 620;
  const topBandHeight = compact ? 104 : 92;

  const boxGap = compact ? 8 : 16;
  const sidePadding = compact ? 10 : Math.max(24, width * 0.06);
  const availableWidth = width - sidePadding * 2 - boxGap * 2;
  const currentWidth = availableWidth * 0.22;
  const operatorWidth = availableWidth * 0.48;
  const nextWidth = availableWidth - currentWidth - operatorWidth;
  const boxY = 10;
  const boxHeight = compact ? 64 : 58;
  const currentX = sidePadding;
  const operatorX = currentX + currentWidth + boxGap;
  const nextX = operatorX + operatorWidth + boxGap;

  roundedBox(context, currentX, boxY, currentWidth, boxHeight, "rgba(98,216,231,.42)", "rgba(13,61,73,.38)");
  roundedBox(context, operatorX, boxY, operatorWidth, boxHeight, "rgba(255,182,74,.42)", "rgba(73,48,14,.3)");
  roundedBox(context, nextX, boxY, nextWidth, boxHeight, "rgba(169,232,91,.4)", "rgba(45,69,23,.28)");
  label(context, "CURRENT SLICE", currentX + currentWidth / 2, boxY + 19, "center", CYAN, 14);
  label(context, "u(r, z)", currentX + currentWidth / 2, boxY + 43, "center", "#d8f2f5", 14);
  label(context, compact ? "P(Δr)" : "ONE-STEP OPERATOR  P(Δr)", operatorX + operatorWidth / 2, boxY + 34, "center", AMBER, 14);
  label(context, "NEXT SLICE", nextX + nextWidth / 2, boxY + 19, "center", "#a9e85b", 14);
  label(context, "u(r+Δr, z)", nextX + nextWidth / 2, boxY + 43, "center", "#e1f3ce", 14);

  context.strokeStyle = "rgba(213, 239, 242, .5)";
  context.lineWidth = 1;
  [currentX + currentWidth + 2, operatorX + operatorWidth + 2].forEach((startX) => {
    context.beginPath();
    context.moveTo(startX, boxY + boxHeight / 2);
    context.lineTo(startX + boxGap - 4, boxY + boxHeight / 2);
    context.stroke();
  });

  const left = 45;
  const right = 18;
  const top = topBandHeight;
  const bottom = 31;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const columns = Math.max(100, Math.min(180, Math.round(plotWidth / 6)));
  const rows = Math.max(55, Math.min(90, Math.round(plotHeight / 4)));
  const cellWidth = plotWidth / columns;
  const cellHeight = plotHeight / rows;

  context.fillStyle = "#061c25";
  context.fillRect(left, top, plotWidth, plotHeight);
  for (let row = 0; row < rows; row += 1) {
    const depth = row / Math.max(rows - 1, 1);
    for (let column = 0; column < columns; column += 1) {
      const range = 0.008 + column / Math.max(columns - 1, 1);
      let realPressure = 0;
      let imaginaryPressure = 0;
      const sourceDepth = 0.17;
      const rangeCoordinate = 0.025 + range * 4.5;
      const imageSources: ReadonlyArray<readonly [number, number]> = [
        [sourceDepth, 1],
        [-sourceDepth, -0.92],
        [2 - sourceDepth, 0.76],
        [2 + sourceDepth, -0.58],
        [-2 + sourceDepth, 0.43],
        [-2 - sourceDepth, -0.3],
      ];
      imageSources.forEach(([imageDepth, reflectionWeight], index) => {
        const verticalOffset = depth - imageDepth;
        const pathLength = Math.hypot(rangeCoordinate, verticalOffset);
        const amplitude = reflectionWeight * Math.exp(-0.11 * pathLength) / Math.sqrt(pathLength + 0.018);
        const phase = 47 * pathLength
          + 1.8 * range * depth
          + 0.22 * index * Math.sin(range * Math.PI * 2);
        realPressure += amplitude * Math.cos(phase);
        imaginaryPressure += amplitude * Math.sin(phase);
      });
      for (let mode = 1; mode <= 6; mode += 1) {
        const modeAmplitude = 0.09 * Math.sin(mode * Math.PI * sourceDepth) * Math.sin(mode * Math.PI * depth);
        const modePhase = 35 * range * Math.sqrt(1 - Math.pow(mode / 15, 2));
        realPressure += modeAmplitude * Math.cos(modePhase);
        imaginaryPressure += modeAmplitude * Math.sin(modePhase);
      }
      const pressure = Math.hypot(realPressure, imaginaryPressure);
      const transmissionLossDb = 50 - 20 * Math.log10(pressure + 0.012) + range * 20;
      const normalizedTl = (transmissionLossDb - 38) / 76;
      context.fillStyle = tlColor(normalizedTl);
      context.fillRect(
        left + column * cellWidth,
        top + row * cellHeight,
        Math.ceil(cellWidth + 0.5),
        Math.ceil(cellHeight + 0.5),
      );
    }
  }

  context.strokeStyle = GRID;
  context.lineWidth = 2.8;
  context.beginPath();
  for (let column = 0; column <= 5; column += 1) {
    const x = left + (column / 5) * plotWidth;
    context.moveTo(x, top);
    context.lineTo(x, top + plotHeight);
  }
  for (let row = 0; row <= 4; row += 1) {
    const y = top + (row / 4) * plotHeight;
    context.moveTo(left, y);
    context.lineTo(left + plotWidth, y);
  }
  context.stroke();

  const currentFraction = 0.07 + (progress % 1) * 0.82;
  const stepFraction = Math.min(0.06, Math.max(0.035, 45 / Math.max(plotWidth, 1)));
  const currentSliceX = left + currentFraction * plotWidth;
  const nextSliceX = left + Math.min(currentFraction + stepFraction, 0.96) * plotWidth;
  context.fillStyle = "rgba(1, 11, 16, .34)";
  context.fillRect(nextSliceX, top, left + plotWidth - nextSliceX, plotHeight);

  const scaleWidth = Math.min(145, plotWidth * 0.22);
  const scaleX = left + plotWidth - scaleWidth - 10;
  const scaleY = top + 10;
  for (let index = 0; index < Math.round(scaleWidth); index += 1) {
    context.fillStyle = tlColor(index / Math.max(scaleWidth - 1, 1));
    context.fillRect(scaleX + index, scaleY, 1.5, 8);
  }
  label(context, "低 TL", scaleX, scaleY + 20, "left", "#d6e8ea");
  label(context, "高 TL", scaleX + scaleWidth, scaleY + 20, "right", "#d6e8ea");
  label(context, "TL / dB", scaleX + scaleWidth / 2, scaleY - 3, "center", "#d6e8ea");

  context.fillStyle = "rgba(255, 224, 161, .2)";
  context.fillRect(currentSliceX, top, nextSliceX - currentSliceX, plotHeight);

  context.strokeStyle = "#d9fbff";
  context.lineWidth = 6;
  context.shadowColor = CYAN;
  context.shadowBlur = 15;
  context.beginPath();
  context.moveTo(currentSliceX, top);
  context.lineTo(currentSliceX, top + plotHeight);
  context.stroke();
  context.strokeStyle = "#ffe0a1";
  context.beginPath();
  context.moveTo(nextSliceX, top);
  context.lineTo(nextSliceX, top + plotHeight);
  context.stroke();
  context.shadowBlur = 0;

  context.fillStyle = "rgba(2, 18, 25, .84)";
  context.fillRect(currentSliceX - 48, top + 6, 43, 20);
  context.fillRect(nextSliceX + 5, top + 6, 72, 20);
  label(context, "u(r)", currentSliceX - 10, top + 21, "right", "#d9fbff", 14);
  label(context, "u(r+Δr)", nextSliceX + 10, top + 21, "left", "#ffe0a1", 14);

  context.strokeStyle = AMBER;
  context.lineWidth = 2.5;
  context.beginPath();
  context.moveTo(currentSliceX, top - 9);
  context.lineTo(nextSliceX, top - 9);
  context.moveTo(currentSliceX, top - 14);
  context.lineTo(currentSliceX, top - 4);
  context.moveTo(nextSliceX, top - 14);
  context.lineTo(nextSliceX, top - 4);
  context.stroke();
  label(context, "Δr", (currentSliceX + nextSliceX) / 2, top - 17, "center", "#ffe0a1", 14);

  [0, 4, 8, 12, 16, 20].forEach((rangeKm, index) => {
    label(context, `${rangeKm}`, left + (index / 5) * plotWidth, height - 15);
  });
  [0, 75, 150, 225, 300].forEach((depthM, index) => {
    label(context, `${depthM}`, left - 7, top + (index / 4) * plotHeight + 3, "right");
  });
  label(context, "距离 r / km · 逐步向右推进", left + plotWidth / 2, height - 3);
  context.save();
  context.translate(12, top + plotHeight / 2);
  context.rotate(-Math.PI / 2);
  label(context, "深度 z / m", 0, 0);
  context.restore();
}
