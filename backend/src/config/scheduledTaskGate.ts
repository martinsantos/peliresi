/** Startup-only pause for cron registration and the email queue timer.
 * It does not make requests read-only, stop existing processes, or cancel jobs
 * already running in another worker. Every worker must be restarted with the
 * same explicit setting for a controlled validation window.
 */
export function createScheduledTaskGate(
  setting: string | undefined,
  reportPaused: () => void,
): { paused: boolean; run: (start: () => void) => void } {
  const value = setting?.trim().toLowerCase() ?? '';
  if (value !== '' && value !== 'true' && value !== 'false') {
    throw new Error('SITREP_PAUSE_BACKGROUND_JOBS must be true or false');
  }

  const paused = value === 'true';
  if (paused) reportPaused();
  return {
    paused,
    run(start) {
      if (!paused) start();
    },
  };
}
