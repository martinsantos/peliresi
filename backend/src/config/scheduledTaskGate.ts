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

/** One startup owner for every cron family. A named systemd owner requires an
 * explicit opt-in; publishing code alone must not start sweeps over real data.
 * PM2 keeps its historic instance-0 behavior. The deployment must ensure the
 * named systemd service is a singleton before setting the opt-in.
 */
export function scheduledTaskOwnership(env: NodeJS.ProcessEnv = process.env): { owner: boolean; reason: string } {
  const instance = env.NODE_APP_INSTANCE || env.INSTANCE_ID || env.pm_id || '0';
  const configured = env.SITREP_SCHEDULER_OWNER_INSTANCE;
  const designated = configured?.trim();
  if (configured !== undefined && designated !== '0' && designated !== 'migration-rehearsal') {
    throw new Error('SITREP_SCHEDULER_OWNER_INSTANCE must be 0 or migration-rehearsal');
  }
  if (designated === 'migration-rehearsal') {
    const owner = env.NODE_ENV === 'production' && instance === designated
      && !env.pm_id && !env.INSTANCE_ID;
    return { owner, reason: owner ? 'systemd singleton opt-in' : `instance ${instance} is not the opted-in production systemd singleton` };
  }
  const owner = instance === '0';
  return { owner, reason: owner ? 'PM2 instance 0' : `instance ${instance} is not scheduler owner 0` };
}

export function mayRegisterScheduledJob(job: string, env: NodeJS.ProcessEnv = process.env): boolean {
  const decision = scheduledTaskOwnership(env);
  if (!decision.owner) console.log(`[${job}] Cron no registrado: ${decision.reason}`);
  return decision.owner;
}
