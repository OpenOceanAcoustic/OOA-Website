import type { NormalModeResult } from "./public-types";

export class ModeCache {
  readonly #values = new Map<string, NormalModeResult>();
  get(key: string): NormalModeResult | undefined { return this.#values.get(key); }
  set(key: string, value: NormalModeResult): void { this.#values.set(key, value); }
  clear(): void { this.#values.clear(); }
}
