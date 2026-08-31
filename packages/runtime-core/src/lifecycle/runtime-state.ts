export type RuntimeState =
  | "idle"
  | "preparing"
  | "ready"
  | "running"
  | "cancelling"
  | "disposed"
  | "error";
