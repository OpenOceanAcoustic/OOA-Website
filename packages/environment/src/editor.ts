import type { AcousticEnvironment, SoundSpeedPoint } from "./types";
import { assertEnvironment } from "./validation";

export class EnvironmentEditor {
  constructor(readonly value: AcousticEnvironment) {}

  withFrequency(frequencyHz: number): EnvironmentEditor {
    return new EnvironmentEditor({ ...this.value, frequencyHz });
  }

  withSoundSpeedProfile(soundSpeedProfile: readonly SoundSpeedPoint[]): EnvironmentEditor {
    return new EnvironmentEditor({ ...this.value, soundSpeedProfile: [...soundSpeedProfile] });
  }

  build(): AcousticEnvironment {
    return assertEnvironment(this.value);
  }
}
