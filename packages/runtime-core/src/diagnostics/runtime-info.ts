export interface RuntimeInfo {
  readonly packageName: string;
  readonly packageVersion: string;
  readonly model: string;
  readonly executionMode: string;
  readonly threadCount: number;
  readonly memoryLimitBytes: number;
}
