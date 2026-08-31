export function cancellationReason(signal: AbortSignal, fallback = "cancelled"): string {
  return typeof signal.reason === "string" && signal.reason.length > 0
    ? signal.reason
    : fallback;
}

export function throwIfCancelled(signal: AbortSignal): void {
  if (signal.aborted) {
    throw new DOMException(cancellationReason(signal), "AbortError");
  }
}
