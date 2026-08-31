import type { RuntimeInfo } from "../diagnostics/runtime-info";
import type { RuntimeLifecycle } from "./runtime-lifecycle";

export class RuntimeManager {
  #active: { readonly key: string; readonly runtime: RuntimeLifecycle } | null = null;

  get activeKey(): string | null {
    return this.#active?.key ?? null;
  }

  async activate(key: string, create: () => RuntimeLifecycle): Promise<RuntimeInfo> {
    if (this.#active?.key === key) return this.#active.runtime.prepare();
    await this.releaseActive("route changed");
    const runtime = create();
    this.#active = { key, runtime };
    try {
      return await runtime.prepare();
    } catch (error) {
      if (this.#active?.runtime === runtime) this.#active = null;
      await runtime.dispose();
      throw error;
    }
  }

  async releaseActive(reason = "released"): Promise<void> {
    const active = this.#active;
    this.#active = null;
    if (active === null) return;
    active.runtime.cancel(reason);
    await active.runtime.dispose();
  }
}
