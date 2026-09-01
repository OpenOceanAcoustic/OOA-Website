export type EnvironmentDocumentKind =
  | "json"
  | "bellhop-env"
  | "bellhop-ssp"
  | "bellhop-bty"
  | "bellhop-companion"
  | "kraken-env"
  | "kraken-flp"
  | "ram-in";

export interface EnvironmentDocument {
  readonly name: string;
  readonly kind: EnvironmentDocumentKind;
  readonly content: string;
}

export interface SoundSpeedPoint {
  readonly depthM: number;
  readonly speedMps: number;
}

export interface BathymetryPoint {
  readonly rangeM: number;
  readonly depthM: number;
}

export interface BottomMaterial {
  readonly soundSpeedMps: number;
  readonly densityKgM3: number;
  readonly attenuationDbPerWavelength: number;
}

export interface AcousticEnvironment {
  readonly title: string;
  readonly frequencyHz: number;
  readonly waterDepthM: number;
  readonly soundSpeedProfile: readonly SoundSpeedPoint[];
  readonly bathymetry: readonly BathymetryPoint[];
  readonly bottom: BottomMaterial;
}

export interface EnvironmentValidationIssue {
  readonly path: string;
  readonly message: string;
}

export interface ImportedEnvironment {
  readonly environment: AcousticEnvironment;
  readonly documents: readonly EnvironmentDocument[];
  readonly modelHints: Readonly<Record<string, unknown>>;
}

export interface ImportedModelEnvironment<Hints extends Readonly<Record<string, unknown>> = Readonly<Record<string, unknown>>> {
  readonly sourceId: string;
  readonly environment: AcousticEnvironment;
  readonly modelHints: Hints;
  readonly documents: readonly {
    readonly name: string;
    readonly kind: EnvironmentDocumentKind;
  }[];
}
