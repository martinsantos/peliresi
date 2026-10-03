export class DeadlineError extends Error {
  constructor(stage: string, milliseconds: number) {
    super('Android driver deadline exceeded: ' + stage + ' (' + milliseconds + 'ms)');
    this.name = 'DeadlineError';
  }
}

// Bound driver operations that do not honour AndroidDevice's action timeout.
// A late operation is not retried or turned into PASS. Its rejection is still
// consumed, and the owning caller aborts the incomplete suite with evidence.
export async function withinDeadline<T>(stage: string, milliseconds: number, operation: () => Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve().then(operation),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new DeadlineError(stage, milliseconds)), milliseconds); }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
