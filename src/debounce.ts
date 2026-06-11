export class Debouncer {
  private timer: NodeJS.Timeout | undefined;

  constructor(private readonly delayMs: number) {}

  schedule(callback: () => void): void {
    this.dispose();
    this.timer = setTimeout(callback, this.delayMs);
  }

  dispose(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
  }
}
