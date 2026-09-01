import type { AcousticEnvironment, EnvironmentValidationIssue } from "./types";

export function validateEnvironment(environment: AcousticEnvironment): EnvironmentValidationIssue[] {
  const issues: EnvironmentValidationIssue[] = [];
  if (environment.title.trim().length === 0) issues.push({ path: "title", message: "标题不能为空" });
  if (!(environment.frequencyHz > 0)) issues.push({ path: "frequencyHz", message: "频率必须大于 0" });
  if (!(environment.waterDepthM > 0)) issues.push({ path: "waterDepthM", message: "水深必须大于 0" });
  if (environment.soundSpeedProfile.length < 2) {
    issues.push({ path: "soundSpeedProfile", message: "SSP 至少需要两个点" });
  }
  environment.soundSpeedProfile.forEach((point, index) => {
    if (index > 0 && point.depthM <= (environment.soundSpeedProfile[index - 1]?.depthM ?? -Infinity)) {
      issues.push({ path: `soundSpeedProfile[${index}].depthM`, message: "SSP 深度必须严格递增" });
    }
    if (!(point.speedMps > 0)) {
      issues.push({ path: `soundSpeedProfile[${index}].speedMps`, message: "声速必须大于 0" });
    }
  });
  return issues;
}

export function assertEnvironment(environment: AcousticEnvironment): AcousticEnvironment {
  const issues = validateEnvironment(environment);
  if (issues.length > 0) throw new Error(issues.map((issue) => `${issue.path}: ${issue.message}`).join("; "));
  return environment;
}
