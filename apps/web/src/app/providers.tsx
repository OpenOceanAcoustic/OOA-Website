import { RuntimeManager, type RuntimeInfo, type RuntimeLifecycle } from "@ooa/runtime-core";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

interface RuntimeCoordinator {
  activate(key: string, create: () => RuntimeLifecycle): Promise<RuntimeInfo>;
  release(key: string): Promise<void>;
}

const RuntimeContext = createContext<RuntimeCoordinator | null>(null);

export function AppProviders({ children }: { readonly children: ReactNode }) {
  const manager = useMemo(() => new RuntimeManager(), []);
  const value = useMemo<RuntimeCoordinator>(() => ({
    activate: (key, create) => manager.activate(key, create),
    release: async (key) => { if (manager.activeKey === key) await manager.releaseActive("route changed"); },
  }), [manager]);
  useEffect(() => () => { void manager.releaseActive("application disposed"); }, [manager]);
  return <RuntimeContext.Provider value={value}>{children}</RuntimeContext.Provider>;
}

export interface RouteRuntimeState<T extends RuntimeLifecycle> {
  readonly runtime: T;
  readonly info: RuntimeInfo | null;
  readonly error: string | null;
}

export function useRouteRuntime<T extends RuntimeLifecycle>(key: string, create: () => T): RouteRuntimeState<T> {
  const coordinator = useContext(RuntimeContext);
  if (coordinator === null) throw new Error("useRouteRuntime must be used inside AppProviders");
  const [runtime] = useState(create);
  const [info, setInfo] = useState<RuntimeInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    void coordinator.activate(key, () => runtime).then((value) => { if (active) setInfo(value); }, (reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason.message : String(reason));
    });
    return () => { active = false; void coordinator.release(key); };
  }, [coordinator, key, runtime]);
  return { runtime, info, error };
}
