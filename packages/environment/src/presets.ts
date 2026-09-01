import type { AcousticEnvironment } from "./types";

const bottom = Object.freeze({
  soundSpeedMps: 1700,
  densityKgM3: 1800,
  attenuationDbPerWavelength: 0.5,
});

export const ENVIRONMENT_PRESETS = Object.freeze({
  pekeris: Object.freeze<AcousticEnvironment>({
    title: "Pekeris waveguide",
    frequencyHz: 100,
    waterDepthM: 200,
    soundSpeedProfile: Object.freeze([
      Object.freeze({ depthM: 0, speedMps: 1500 }),
      Object.freeze({ depthM: 200, speedMps: 1500 }),
    ]),
    bathymetry: Object.freeze([]),
    bottom,
  }),
  munk: Object.freeze<AcousticEnvironment>({
    title: "Munk deep-water channel",
    frequencyHz: 50,
    waterDepthM: 5000,
    soundSpeedProfile: Object.freeze(Array.from({ length: 26 }, (_, index) => {
      const depthM = index * 200;
      const eta = 2 * (depthM - 1300) / 1300;
      return Object.freeze({
        depthM,
        speedMps: 1500 * (1 + 0.00737 * (eta + Math.exp(-eta) - 1)),
      });
    })),
    bathymetry: Object.freeze([]),
    bottom: Object.freeze({ ...bottom, soundSpeedMps: 1600 }),
  }),
});
