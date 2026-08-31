const FIELD_STOPS = [
  [0.00, [128, 0, 0]],
  [0.13, [245, 37, 0]],
  [0.27, [255, 157, 0]],
  [0.42, [247, 239, 33]],
  [0.56, [38, 210, 139]],
  [0.70, [0, 188, 225]],
  [0.84, [0, 80, 214]],
  [1.00, [3, 4, 104]],
];

const DELTA_STOPS = [
  [0.00, [12, 48, 122]],
  [0.23, [38, 125, 193]],
  [0.48, [190, 230, 235]],
  [0.50, [234, 243, 240]],
  [0.52, [246, 220, 184]],
  [0.77, [229, 107, 51]],
  [1.00, [122, 18, 30]],
];

function interpolateStops(stops, value) {
  const t = Math.max(0, Math.min(1, Number(value) || 0));
  let right = 1;
  while (right < stops.length - 1 && t > stops[right][0]) right += 1;
  const left = right - 1;
  const span = Math.max(1e-12, stops[right][0] - stops[left][0]);
  const mix = (t - stops[left][0]) / span;
  return stops[left][1].map((channel, index) => (
    Math.round(channel + (stops[right][1][index] - channel) * mix)
  ));
}

export function fieldColor(value, minimum = 60, maximum = 120) {
  return interpolateStops(FIELD_STOPS, (value - minimum) / Math.max(1e-12, maximum - minimum));
}

export function deltaColor(value, magnitude) {
  const limit = Math.max(1e-6, Math.abs(magnitude));
  return interpolateStops(DELTA_STOPS, 0.5 + 0.5 * value / limit);
}

export function fitCanvas(canvas) {
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const bounds = canvas.getBoundingClientRect();
  const width = Math.max(1, Math.round(bounds.width || Number(canvas.getAttribute("width")) || 640));
  const height = Math.max(1, Math.round(bounds.height || Number(canvas.getAttribute("height")) || 320));
  const pixelWidth = Math.round(width * ratio);
  const pixelHeight = Math.round(height * ratio);
  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
  }
  const context = canvas.getContext("2d");
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  return { context, width, height, ratio };
}

function niceNumber(value, digits = 2) {
  const magnitude = Math.abs(value);
  if (magnitude >= 1000) return `${(value / 1000).toFixed(magnitude % 1000 === 0 ? 0 : 1)}k`;
  if (magnitude > 0 && magnitude < 0.01) return value.toExponential(1);
  if (magnitude >= 100) return value.toFixed(0);
  if (magnitude >= 10) return value.toFixed(1);
  return value.toFixed(digits);
}

export function createPlot(canvas, options = {}) {
  const { context, width, height } = fitCanvas(canvas);
  const padding = options.padding || { left: 53, right: 17, top: 20, bottom: 38 };
  const plotWidth = Math.max(1, width - padding.left - padding.right);
  const plotHeight = Math.max(1, height - padding.top - padding.bottom);
  const xMinimum = Number(options.xMinimum ?? 0);
  const xMaximum = Number(options.xMaximum ?? 1);
  const yMinimum = Number(options.yMinimum ?? 0);
  const yMaximum = Number(options.yMaximum ?? 1);
  const depthAxis = options.depthAxis === true;
  const x = (value) => padding.left + (value - xMinimum) / Math.max(1e-12, xMaximum - xMinimum) * plotWidth;
  const y = depthAxis
    ? (value) => padding.top + (value - yMinimum) / Math.max(1e-12, yMaximum - yMinimum) * plotHeight
    : (value) => padding.top + plotHeight - (value - yMinimum) / Math.max(1e-12, yMaximum - yMinimum) * plotHeight;

  context.clearRect(0, 0, width, height);
  context.fillStyle = options.background || "#041721";
  context.fillRect(0, 0, width, height);

  const xTicks = Math.max(2, options.xTicks || 5);
  const yTicks = Math.max(2, options.yTicks || 5);
  context.lineWidth = 1;
  context.font = "9px ui-monospace, SFMono-Regular, Consolas, monospace";
  for (let index = 0; index <= xTicks; index += 1) {
    const value = xMinimum + (xMaximum - xMinimum) * index / xTicks;
    const pixel = padding.left + plotWidth * index / xTicks;
    context.strokeStyle = "rgba(84, 158, 177, .13)";
    context.beginPath(); context.moveTo(pixel, padding.top); context.lineTo(pixel, padding.top + plotHeight); context.stroke();
    context.fillStyle = "#607f89";
    context.textAlign = "center";
    const formatter = options.xFormatter || niceNumber;
    context.fillText(formatter(value), pixel, height - 17);
  }
  for (let index = 0; index <= yTicks; index += 1) {
    const value = depthAxis
      ? yMinimum + (yMaximum - yMinimum) * index / yTicks
      : yMaximum - (yMaximum - yMinimum) * index / yTicks;
    const pixel = padding.top + plotHeight * index / yTicks;
    context.strokeStyle = "rgba(84, 158, 177, .13)";
    context.beginPath(); context.moveTo(padding.left, pixel); context.lineTo(padding.left + plotWidth, pixel); context.stroke();
    context.fillStyle = "#607f89";
    context.textAlign = "right";
    const formatter = options.yFormatter || niceNumber;
    context.fillText(formatter(value), padding.left - 7, pixel + 3);
  }

  context.fillStyle = "#6a8b95";
  context.font = "9px ui-monospace, SFMono-Regular, Consolas, monospace";
  context.textAlign = "center";
  if (options.xLabel) context.fillText(options.xLabel, padding.left + plotWidth / 2, height - 4);
  if (options.yLabel) {
    context.save();
    context.translate(10, padding.top + plotHeight / 2);
    context.rotate(-Math.PI / 2);
    context.fillText(options.yLabel, 0, 0);
    context.restore();
  }

  return {
    context, width, height, padding, plotWidth, plotHeight,
    xMinimum, xMaximum, yMinimum, yMaximum, x, y,
  };
}

export function drawPolyline(plot, points, options = {}) {
  if (!points || points.length === 0) return;
  const { context } = plot;
  context.save();
  context.strokeStyle = options.color || "#62d8e7";
  context.lineWidth = options.width || 1.7;
  context.globalAlpha = options.alpha ?? 1;
  context.setLineDash(options.dash || []);
  if (options.glow) {
    context.shadowColor = options.color || "#62d8e7";
    context.shadowBlur = options.glow;
  }
  context.beginPath();
  let started = false;
  for (const point of points) {
    const px = plot.x(Number(point[0]));
    const py = plot.y(Number(point[1]));
    if (!Number.isFinite(px) || !Number.isFinite(py)) { started = false; continue; }
    if (started) context.lineTo(px, py); else { context.moveTo(px, py); started = true; }
  }
  context.stroke();
  context.restore();
}

export function drawPoints(plot, points, options = {}) {
  const { context } = plot;
  context.save();
  for (const point of points || []) {
    const px = plot.x(Number(point[0]));
    const py = plot.y(Number(point[1]));
    if (!Number.isFinite(px) || !Number.isFinite(py)) continue;
    const radius = typeof options.radius === "function" ? options.radius(point) : (options.radius || 2.5);
    const color = typeof options.color === "function" ? options.color(point) : (options.color || "#62d8e7");
    context.fillStyle = color;
    context.strokeStyle = options.stroke || color;
    context.lineWidth = options.strokeWidth || 1;
    context.beginPath(); context.arc(px, py, radius, 0, Math.PI * 2); context.fill();
    if (options.stroke) context.stroke();
  }
  context.restore();
}

export function drawHeatmap(canvas, data, options = {}) {
  const values = data.values;
  const rows = Math.max(1, Number(data.rows));
  const columns = Math.max(1, Number(data.columns));
  const plot = createPlot(canvas, {
    xMinimum: options.xMinimum ?? 0,
    xMaximum: options.xMaximum ?? 1,
    yMinimum: options.yMinimum ?? 0,
    yMaximum: options.yMaximum ?? 1,
    xLabel: options.xLabel,
    yLabel: options.yLabel,
    xFormatter: options.xFormatter,
    yFormatter: options.yFormatter,
    depthAxis: true,
    padding: options.padding,
  });
  const offscreen = document.createElement("canvas");
  offscreen.width = columns;
  offscreen.height = rows;
  const offscreenContext = offscreen.getContext("2d");
  const image = offscreenContext.createImageData(columns, rows);
  const minimum = Number(options.minimum ?? 60);
  const maximum = Number(options.maximum ?? 120);
  const divergingMagnitude = Number(options.divergingMagnitude ?? 0);
  for (let index = 0; index < rows * columns; index += 1) {
    const value = Number(values[index]);
    const color = Number.isFinite(value)
      ? (divergingMagnitude > 0 ? deltaColor(value, divergingMagnitude) : fieldColor(value, minimum, maximum))
      : [3, 17, 25];
    image.data[index * 4] = color[0];
    image.data[index * 4 + 1] = color[1];
    image.data[index * 4 + 2] = color[2];
    image.data[index * 4 + 3] = 255;
  }
  offscreenContext.putImageData(image, 0, 0);
  plot.context.save();
  plot.context.imageSmoothingEnabled = true;
  plot.context.imageSmoothingQuality = "high";
  plot.context.globalAlpha = options.alpha ?? 0.96;
  plot.context.drawImage(
    offscreen,
    plot.padding.left,
    plot.padding.top,
    plot.plotWidth,
    plot.plotHeight,
  );
  plot.context.restore();

  const bathymetry = options.bathymetry;
  if (bathymetry && bathymetry.length > 1) {
    plot.context.save();
    plot.context.beginPath();
    bathymetry.forEach((point, index) => {
      const px = plot.x(point[0]);
      const py = plot.y(point[1]);
      if (index === 0) plot.context.moveTo(px, py); else plot.context.lineTo(px, py);
    });
    plot.context.lineTo(plot.x(bathymetry.at(-1)[0]), plot.y(plot.yMaximum));
    plot.context.lineTo(plot.x(bathymetry[0][0]), plot.y(plot.yMaximum));
    plot.context.closePath();
    plot.context.fillStyle = options.bottomColor || "#281f19";
    plot.context.fill();
    plot.context.beginPath();
    bathymetry.forEach((point, index) => {
      if (index === 0) plot.context.moveTo(plot.x(point[0]), plot.y(point[1]));
      else plot.context.lineTo(plot.x(point[0]), plot.y(point[1]));
    });
    plot.context.strokeStyle = options.bottomLineColor || "#d5a968";
    plot.context.lineWidth = 1.4;
    plot.context.stroke();
    plot.context.restore();
  }
  return plot;
}

export function valueRange(values, options = {}) {
  let minimum = Number.POSITIVE_INFINITY;
  let maximum = Number.NEGATIVE_INFINITY;
  for (const value of values || []) {
    const number = Number(value);
    if (!Number.isFinite(number)) continue;
    minimum = Math.min(minimum, number);
    maximum = Math.max(maximum, number);
  }
  if (!Number.isFinite(minimum) || !Number.isFinite(maximum)) return options.fallback || [0, 1];
  const padding = Math.max(options.minimumPadding || 0, (maximum - minimum) * (options.paddingFraction ?? 0.08));
  if (maximum === minimum) return [minimum - Math.max(1, padding), maximum + Math.max(1, padding)];
  return [minimum - padding, maximum + padding];
}

export function nearestIndex(axis, value) {
  if (!axis || axis.length === 0) return 0;
  let best = 0;
  let distance = Number.POSITIVE_INFINITY;
  for (let index = 0; index < axis.length; index += 1) {
    const candidate = Math.abs(Number(axis[index]) - value);
    if (candidate < distance) { best = index; distance = candidate; }
  }
  return best;
}

export function pointerValue(canvas, event, plot) {
  const bounds = canvas.getBoundingClientRect();
  const px = Math.max(0, Math.min(1, (event.clientX - bounds.left - plot.padding.left) / plot.plotWidth));
  const py = Math.max(0, Math.min(1, (event.clientY - bounds.top - plot.padding.top) / plot.plotHeight));
  return {
    x: plot.xMinimum + px * (plot.xMaximum - plot.xMinimum),
    y: plot.yMinimum + py * (plot.yMaximum - plot.yMinimum),
  };
}

