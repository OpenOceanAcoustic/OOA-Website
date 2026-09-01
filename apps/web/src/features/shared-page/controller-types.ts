export interface MountedModelPage {
  readonly ready: Promise<void>;
  dispose(): Promise<void>;
}
