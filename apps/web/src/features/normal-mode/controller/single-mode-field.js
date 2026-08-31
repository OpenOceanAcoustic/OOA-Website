const MINIMUM_PRESSURE = 1.1754943508222875e-38;
const TWO_PI_SQUARE_ROOT = Math.sqrt(2 * Math.PI);

function finiteNumber(value, label) {
  const number = Number(value);
  if (!Number.isFinite(number)) throw new TypeError(`${label} must be finite`);
  return number;
}

function complexMultiply(leftReal, leftImaginary, rightReal, rightImaginary) {
  return [
    leftReal * rightReal - leftImaginary * rightImaginary,
    leftReal * rightImaginary + leftImaginary * rightReal,
  ];
}

function complexDivide(leftReal, leftImaginary, rightReal, rightImaginary) {
  const denominator = rightReal * rightReal + rightImaginary * rightImaginary;
  if (!(denominator > 0)) throw new RangeError("horizontal wavenumber must be non-zero");
  return [
    (leftReal * rightReal + leftImaginary * rightImaginary) / denominator,
    (leftImaginary * rightReal - leftReal * rightImaginary) / denominator,
  ];
}

function complexSquareRoot(real, imaginary) {
  const magnitude = Math.hypot(real, imaginary);
  const rootReal = Math.sqrt(Math.max(0, (magnitude + real) / 2));
  const rootImaginary = Math.sign(imaginary || 1) * Math.sqrt(Math.max(0, (magnitude - real) / 2));
  return [rootReal, rootImaginary];
}

function modeShapeSample(modes, modeIndex, depthIndex) {
  const depthCount = modes.depthsM.length;
  const offset = (modeIndex * depthCount + depthIndex) * 2;
  return [
    finiteNumber(modes.modeShapesInterleaved[offset], "mode shape real part"),
    finiteNumber(modes.modeShapesInterleaved[offset + 1], "mode shape imaginary part"),
  ];
}

function interpolateModeShape(modes, modeIndex, depthM) {
  const depths = modes.depthsM;
  if (depthM <= depths[0]) return modeShapeSample(modes, modeIndex, 0);
  const lastIndex = depths.length - 1;
  if (depthM >= depths[lastIndex]) return modeShapeSample(modes, modeIndex, lastIndex);

  let low = 0;
  let high = lastIndex;
  while (high - low > 1) {
    const middle = Math.floor((low + high) / 2);
    if (Number(depths[middle]) <= depthM) low = middle;
    else high = middle;
  }
  const leftDepth = finiteNumber(depths[low], "mode depth");
  const rightDepth = finiteNumber(depths[high], "mode depth");
  const fraction = (depthM - leftDepth) / Math.max(Number.EPSILON, rightDepth - leftDepth);
  const left = modeShapeSample(modes, modeIndex, low);
  const right = modeShapeSample(modes, modeIndex, high);
  return [
    left[0] + fraction * (right[0] - left[0]),
    left[1] + fraction * (right[1] - left[1]),
  ];
}

function validateResult(result, modeIndex) {
  const modes = result?.modes;
  const field = result?.field;
  if (!modes || !field) throw new TypeError("Normal Mode result must contain modes and field");
  if (!Number.isInteger(modeIndex) || modeIndex < 0 || modeIndex >= Number(modes.count)) {
    throw new RangeError(`modeIndex must be between 0 and ${Math.max(0, Number(modes.count) - 1)}`);
  }
  if (!modes.depthsM || modes.depthsM.length < 2) {
    throw new RangeError("at least two mode-shape depth samples are required");
  }
  if (modes.modeShapesInterleaved?.length !== modes.count * modes.depthsM.length * 2) {
    throw new RangeError("mode shape storage does not match mode and depth counts");
  }
  if (modes.horizontalWavenumbersInterleaved?.length !== modes.count * 2) {
    throw new RangeError("horizontal wavenumber storage does not match mode count");
  }
  if (field.rows !== field.depthsM?.length || field.columns !== field.rangesKm?.length) {
    throw new RangeError("field axes do not match its declared shape");
  }
}

/**
 * Synthesizes the selected Kraken point-source mode without normalizing it.
 *
 * H_m(r) = i sqrt(2 pi) exp(i pi/4) phi_m(z_s)
 *          exp(-i k_m r) / sqrt(k_m r)
 * p_m(z, r) = phi_m(z) H_m(r)
 * TL_m = -20 log10 |p_m|
 */
export function synthesizeSingleModeField(result, modeIndex) {
  validateResult(result, modeIndex);
  const { modes, field, environment } = result;
  const krReal = finiteNumber(modes.horizontalWavenumbersInterleaved[modeIndex * 2], "horizontal wavenumber real part");
  const krImaginary = finiteNumber(modes.horizontalWavenumbersInterleaved[modeIndex * 2 + 1], "horizontal wavenumber imaginary part");
  const sourceDepthM = finiteNumber(environment?.sourceDepthM, "source depth");
  const sourceShape = interpolateModeShape(modes, modeIndex, sourceDepthM);
  const rootWavenumber = complexSquareRoot(krReal, krImaginary);

  // i * sqrt(2 pi) * exp(i pi/4) = -sqrt(pi) + i sqrt(pi).
  const factorReal = -TWO_PI_SQUARE_ROOT / Math.SQRT2;
  const factorImaginary = TWO_PI_SQUARE_ROOT / Math.SQRT2;
  const coupledSource = complexMultiply(
    factorReal,
    factorImaginary,
    sourceShape[0],
    sourceShape[1],
  );
  const constant = complexDivide(
    coupledSource[0],
    coupledSource[1],
    rootWavenumber[0],
    rootWavenumber[1],
  );

  const receiverShapes = Array.from(field.depthsM, (depthM) => (
    interpolateModeShape(modes, modeIndex, finiteNumber(depthM, "receiver depth"))
  ));
  const tlDb = new Float32Array(field.rows * field.columns);
  for (let rangeIndex = 0; rangeIndex < field.columns; rangeIndex += 1) {
    const rangeM = finiteNumber(field.rangesKm[rangeIndex], "receiver range") * 1000;
    let propagatedReal = 0;
    let propagatedImaginary = 0;
    if (rangeM > 0) {
      const exponent = Math.max(-700, Math.min(700, krImaginary * rangeM));
      const amplitude = Math.exp(exponent) / Math.sqrt(rangeM);
      const phase = -krReal * rangeM;
      const propagation = complexMultiply(
        constant[0],
        constant[1],
        amplitude * Math.cos(phase),
        amplitude * Math.sin(phase),
      );
      propagatedReal = propagation[0];
      propagatedImaginary = propagation[1];
    }

    for (let depthIndex = 0; depthIndex < field.rows; depthIndex += 1) {
      const receiver = receiverShapes[depthIndex];
      const pressure = complexMultiply(
        receiver[0],
        receiver[1],
        propagatedReal,
        propagatedImaginary,
      );
      const magnitude = Math.max(MINIMUM_PRESSURE, Math.hypot(pressure[0], pressure[1]));
      tlDb[depthIndex * field.columns + rangeIndex] = -20 * Math.log10(magnitude);
    }
  }

  return {
    rows: field.rows,
    columns: field.columns,
    rangesKm: field.rangesKm,
    depthsM: field.depthsM,
    tlDb,
    modeIndex,
    modeNumber: modeIndex + 1,
    horizontalWavenumber: { real: krReal, imaginary: krImaginary },
    sourceCouplingMagnitude: Math.hypot(sourceShape[0], sourceShape[1]),
  };
}

