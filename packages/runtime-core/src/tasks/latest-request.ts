export class LatestRequest {
  #latest = 0;

  next(): number {
    this.#latest += 1;
    return this.#latest;
  }

  isLatest(requestId: number): boolean {
    return requestId === this.#latest;
  }
}
