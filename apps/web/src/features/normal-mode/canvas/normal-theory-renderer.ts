export type NormalTheoryProfile = "pekeris" | "surface-duct" | "deep-channel";

export interface NormalTheoryParameters {
  readonly frequencyHz: number;
  readonly modeCount: number;
  readonly profile: NormalTheoryProfile;
}

interface ModeSample {
  readonly mode: number;
  readonly radialWaveNumber: number;
  readonly phaseSpeed: number;
  readonly groupSpeed: number;
}

const DEPTH_M = 200;
const CYAN = "#62d8e7";
const AMBER = "#ffb64a";
const LIME = "#a9e85b";
const GRID = "rgba(91, 164, 180, 0.14)";
const TEXT = "#71949e";
const MODE_COLORS = [CYAN, AMBER, LIME, "#a88cff", "#ff7290", "#66a3ff"];

function soundSpeed(profile: NormalTheoryProfile, normalizedDepth: number) {
  if (profile === "surface-duct") {
    return 1485 + 34 * normalizedDepth + 10 * normalizedDepth * normalizedDepth;
  }
  if (profile === "deep-channel") {
    const offset = normalizedDepth - 0.62;
    return 1482 + 70 * offset * offset;
  }
  return 1500;
}

function referenceSpeed(profile: NormalTheoryProfile) {
  let total = 0;
  for (let index = 0; index <= 100; index += 1) {
    total += soundSpeed(profile, index / 100);
  }
  return total / 101;
}

function modeSamples(parameters: NormalTheoryParameters): ModeSample[] {
  const angularFrequency = 2 * Math.PI * parameters.frequencyHz;
  const cReference = referenceSpeed(parameters.profile);
  const totalWaveNumber = angularFrequency / cReference;

  return Array.from({ length: parameters.modeCount }, (_, index) => {
    const mode = index + 1;
    const verticalWaveNumber = mode * Math.PI / DEPTH_M;
    const radialWaveNumber = Math.sqrt(
      Math.max(totalWaveNumber * totalWaveNumber - verticalWaveNumber * verticalWaveNumber, 1e-6),
    );
    const phaseSpeed = angularFrequency / radialWaveNumber;
    const groupSpeed = (cReference * cReference) / phaseSpeed;
    return { mode, radialWaveNumber, phaseSpeed, groupSpeed };
  });
}

function prepareCanvas(canvas: HTMLCanvasElement) {
  const rectangle = canvas.getBoundingClientRect();
  const width = Math.round(rectangle.width);
  const height = Math.round(rectangle.height);
  if (width < 2 || height < 2) return null;

  const pixelRatio = 1;
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

function drawGrid(
  context: CanvasRenderingContext2D,
  left: number,
  top: number,
  width: number,
  height: number,
  columns = 5,
  rows = 4,
) {
  context.strokeStyle = GRID;
  context.lineWidth = 1;
  context.beginPath();
  for (let column = 0; column <= columns; column += 1) {
    const x = left + (column / columns) * width;
    context.moveTo(x, top);
    context.lineTo(x, top + height);
  }
  for (let row = 0; row <= rows; row += 1) {
    const y = top + (row / rows) * height;
    context.moveTo(left, y);
    context.lineTo(left + width, y);
  }
  context.stroke();
}

function drawAxisText(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  alignment: CanvasTextAlign = "center",
  fontSize = 12,
) {
  context.fillStyle = TEXT;
  context.font = `${fontSize}px ui-monospace, SFMono-Regular, Menlo, monospace`;
  context.textAlign = alignment;
  context.fillText(text, x, y);
}

function drawGroupSpeedLabel(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
) {
  const prefix = "包络中心 · 群速度";
  context.textAlign = "left";
  context.fillStyle = TEXT;
  context.font = "14px ui-monospace, SFMono-Regular, Menlo, monospace";
  context.fillText(prefix, x, y);

  const symbolX = x + context.measureText(prefix).width + 8;
  context.fillStyle = "#b8e8ed";
  context.font = "italic 20px 'STIX Two Math', 'Cambria Math', serif";
  context.fillText("c", symbolX, y + 1);
  const cWidth = context.measureText("c").width;
  context.font = "italic 12px 'STIX Two Math', 'Cambria Math', serif";
  context.fillText("g", symbolX + cWidth + 1, y + 6);
}

export function renderStandingModes(
  canvas: HTMLCanvasElement,
  parameters: NormalTheoryParameters,
  phase: number,
) {
  const prepared = prepareCanvas(canvas);
  if (!prepared) return;
  const { context, width, height } = prepared;
  const left = 34;
  const right = 14;
  const top = 25;
  const bottom = 27;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const cellWidth = plotWidth / parameters.modeCount;

  drawGrid(context, left, top, plotWidth, plotHeight, parameters.modeCount, 4);
  drawAxisText(context, "海面 0 m", left - 5, top + 3, "right");
  drawAxisText(context, "海底 200 m", left - 5, top + plotHeight + 3, "right");
  drawAxisText(context, "ψₘ(z) · 振动已放慢", left + plotWidth / 2, height - 8);

  for (let index = 0; index < parameters.modeCount; index += 1) {
    const mode = index + 1;
    const centerX = left + cellWidth * (index + 0.5);
    const color = MODE_COLORS[index % MODE_COLORS.length] ?? CYAN;
    context.setLineDash([3, 4]);
    context.strokeStyle = "rgba(112, 161, 172, 0.32)";
    context.beginPath();
    context.moveTo(centerX, top);
    context.lineTo(centerX, top + plotHeight);
    context.stroke();
    context.setLineDash([]);

    context.strokeStyle = color;
    context.lineWidth = 2;
    context.shadowColor = color;
    context.shadowBlur = 7;
    context.beginPath();
    for (let sample = 0; sample <= 120; sample += 1) {
      const depthFraction = sample / 120;
      const eigenfunction = Math.sin(mode * Math.PI * depthFraction);
      const displacement = eigenfunction * Math.cos(phase) * cellWidth * 0.32;
      const x = centerX + displacement;
      const y = top + depthFraction * plotHeight;
      if (sample === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    }
    context.stroke();
    context.shadowBlur = 0;

    context.fillStyle = color;
    context.beginPath();
    context.arc(centerX, top, 2.5, 0, Math.PI * 2);
    context.arc(centerX, top + plotHeight, 2.5, 0, Math.PI * 2);
    context.fill();
    drawAxisText(context, `m=${mode}`, centerX, 15);
  }
}

export function renderDispersion(
  canvas: HTMLCanvasElement,
  parameters: NormalTheoryParameters,
  phase: number,
) {
  const prepared = prepareCanvas(canvas);
  if (!prepared) return;
  const { context, width, height } = prepared;
  const left = 54;
  const right = 18;
  const top = 37;
  const bottom = 35;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const zeroY = top + plotHeight / 2;
  const cReference = referenceSpeed(parameters.profile);
  const dispersionStrength = 0.7 + parameters.modeCount * 0.13 + Math.abs(cReference - 1500) / 35;
  const progress = ((phase % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2) / (Math.PI * 2);
  // Hold both endpoints long enough to compare them, like the reference animation.
  // The actual propagation occupies the middle of the loop and uses smooth easing.
  const travelProgress = Math.max(0, Math.min(1, (progress - 0.12) / 0.7));
  const easedProgress = travelProgress * travelProgress * (3 - 2 * travelProgress);
  const elapsed = easedProgress * 17;
  const initialCenterKm = 2.6;
  const groupVelocity = 0.98;
  const phaseVelocity = 1.17;
  const centerKm = initialCenterKm + groupVelocity * elapsed;
  const centerWaveNumber = Math.PI * 2 * (0.61 + parameters.frequencyHz / 1100);
  const spectralWidth = 0.55;
  const dispersion = -0.36 * dispersionStrength;
  const componentCount = 101;
  let weightTotal = 0;
  const components = Array.from({ length: componentCount }, (_, index) => {
    const normalized = (index - (componentCount - 1) / 2) / ((componentCount - 1) / 2);
    // Sample the Gaussian spectrum out to four standard deviations. A narrower
    // cutoff creates artificial ripples far away from the initial packet.
    const offsetWaveNumber = normalized * 2.2;
    const weight = Math.exp(-0.5 * Math.pow(offsetWaveNumber / spectralWidth, 2));
    weightTotal += weight;
    return { offsetWaveNumber, weight };
  });

  drawGrid(context, left, top, plotWidth, plotHeight, 8, 4);
  context.strokeStyle = "rgba(218, 239, 242, .58)";
  context.lineWidth = 1.5;
  context.beginPath();
  context.moveTo(left, zeroY);
  context.lineTo(left + plotWidth, zeroY);
  context.stroke();

  const packetValues: number[] = [];
  for (let sample = 0; sample <= 900; sample += 1) {
    const rangeKm = (sample / 900) * 40;
    let pressure = 0;
    components.forEach(({ offsetWaveNumber, weight }) => {
      const waveNumber = centerWaveNumber + offsetWaveNumber;
      const angularFrequency = phaseVelocity * centerWaveNumber
        + groupVelocity * offsetWaveNumber
        + dispersion * offsetWaveNumber * offsetWaveNumber;
      pressure += weight * Math.cos(waveNumber * (rangeKm - initialCenterKm) - angularFrequency * elapsed);
    });
    const normalizedPressure = pressure / Math.max(weightTotal, 1e-6);
    packetValues.push(normalizedPressure);
  }

  context.strokeStyle = "rgba(98, 216, 231, .27)";
  context.lineWidth = 1.2;
  context.setLineDash([5, 5]);
  const initialWidthKm = 1 / spectralWidth;
  const envelopeWidthKm = Math.sqrt(
    initialWidthKm * initialWidthKm
      + Math.pow(2 * Math.abs(dispersion) * spectralWidth * elapsed, 2),
  );
  for (const sign of [-1, 1]) {
    context.beginPath();
    for (let sample = 0; sample <= 450; sample += 1) {
      const rangeKm = (sample / 450) * 40;
      const envelope = Math.exp(-0.5 * Math.pow((rangeKm - centerKm) / envelopeWidthKm, 2));
      const amplitude = Math.sqrt(initialWidthKm / envelopeWidthKm) * envelope;
      const x = left + (rangeKm / 40) * plotWidth;
      const y = zeroY - sign * amplitude * plotHeight * 0.41;
      if (sample === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    }
    context.stroke();
  }
  context.setLineDash([]);

  context.strokeStyle = CYAN;
  context.lineWidth = 2.1;
  context.shadowColor = CYAN;
  context.shadowBlur = 6;
  context.beginPath();
  packetValues.forEach((value, sample) => {
    const x = left + (sample / 900) * plotWidth;
    // Keep a fixed vertical scale so dispersion also appears as a falling peak,
    // rather than normalizing every frame back to the same height.
    const y = zeroY - value * plotHeight * 0.41;
    if (sample === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  });
  context.stroke();
  context.shadowBlur = 0;

  const centerX = left + (centerKm / 40) * plotWidth;
  context.setLineDash([4, 5]);
  context.strokeStyle = AMBER;
  context.lineWidth = 1.5;
  context.beginPath();
  context.moveTo(centerX, top + 5);
  context.lineTo(centerX, top + plotHeight - 5);
  context.stroke();
  context.setLineDash([]);
  drawGroupSpeedLabel(context, Math.min(centerX + 9, left + plotWidth - 190), top + 19);

  context.fillStyle = AMBER;
  context.beginPath();
  context.arc(left + 14, top - 18, 3.5, 0, Math.PI * 2);
  context.fill();
  drawAxisText(context, "低频长波在前", left + 24, top - 14, "left", 14);
  context.fillStyle = LIME;
  context.beginPath();
  context.arc(left + 167, top - 18, 3.5, 0, Math.PI * 2);
  context.fill();
  drawAxisText(context, "高频短波滞后", left + 190, top - 14, "left", 14);
  const stateLabel = travelProgress === 0
    ? "起始 · 窄波包"
    : travelProgress === 1
      ? "末态 · 已展宽"
      : "传播中 · 正在频散";
  drawAxisText(context, `${stateLabel}  t/T = ${easedProgress.toFixed(2)}`, left + plotWidth, top - 14, "right", 14);

  [0, 5, 10, 15, 20, 25, 30, 35, 40].forEach((rangeKm, index) => {
    drawAxisText(context, `${rangeKm}`, left + (index / 8) * plotWidth, top + plotHeight + 19, "center", 14);
  });
  drawAxisText(context, "传播坐标 y / km", left + plotWidth / 2, height - 3, "center", 14);
  drawAxisText(context, "归一化声压", left + 4, top + 18, "left", 14);
}

export function renderTravelingModes(
  canvas: HTMLCanvasElement,
  parameters: NormalTheoryParameters,
  phase: number,
) {
  const prepared = prepareCanvas(canvas);
  if (!prepared) return;
  const { context, width, height } = prepared;
  const left = 40;
  const right = 15;
  const top = 22;
  const bottom = 28;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const modes = modeSamples(parameters);
  const firstWaveNumber = modes[0]?.radialWaveNumber ?? 1;

  drawGrid(context, left, top, plotWidth, plotHeight, 5, parameters.modeCount);
  modes.forEach((mode, index) => {
    const baseline = top + ((index + 0.5) / modes.length) * plotHeight;
    const bandHeight = plotHeight / modes.length;
    const color = MODE_COLORS[index % MODE_COLORS.length] ?? CYAN;
    const relativeWaveNumber = mode.radialWaveNumber / firstWaveNumber;

    context.strokeStyle = "rgba(116, 165, 175, 0.22)";
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(left, baseline);
    context.lineTo(left + plotWidth, baseline);
    context.stroke();

    context.strokeStyle = color;
    context.lineWidth = 1.8;
    context.shadowColor = color;
    context.shadowBlur = 6;
    context.beginPath();
    for (let sample = 0; sample <= 420; sample += 1) {
      const distanceFraction = sample / 420;
      const envelope = 1 / Math.sqrt(0.14 + distanceFraction * 2.7);
      const visualCycles = 6.5 * relativeWaveNumber;
      const wave = Math.cos(distanceFraction * visualCycles * Math.PI * 2 - phase);
      const x = left + distanceFraction * plotWidth;
      const y = baseline - wave * envelope * bandHeight * 0.34;
      if (sample === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    }
    context.stroke();
    context.shadowBlur = 0;
    drawAxisText(context, `m=${mode.mode}`, left - 7, baseline + 3, "right");
  });

  [0, 10, 20, 30, 40].forEach((distance, index) => {
    drawAxisText(context, `${distance}`, left + (index / 4) * plotWidth, height - 14);
  });
  drawAxisText(context, "水平距离 r / km · 相位压缩显示", left + plotWidth / 2, height - 3);
}
