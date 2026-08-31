import type { RuntimeLifecycle } from "./runtime-lifecycle";

export type RuntimeFactory<T extends RuntimeLifecycle = RuntimeLifecycle> = () => T;

export class RuntimeRegistry {
  readonly #factories = new Map<string, RuntimeFactory>();

  register(key: string, factory: RuntimeFactory): void {
    if (this.#factories.has(key)) throw new Error(`Runtime ${key} is already registered`);
    this.#factories.set(key, factory);
  }

  create(key: string): RuntimeLifecycle {
    const factory = this.#factories.get(key);
    if (factory === undefined) throw new Error(`Runtime ${key} is not registered`);
    return factory();
  }
}
