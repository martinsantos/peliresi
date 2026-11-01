import { describe, expect, it, vi } from 'vitest';
import { createScheduledTaskGate } from '../../config/scheduledTaskGate';

describe('pausa explícita de tareas programadas al iniciar', () => {
  it.each([undefined, '', ' ', 'false', 'FALSE'])('mantiene el arranque habitual para %s', setting => {
    const report = vi.fn();
    const cron = vi.fn();
    const email = vi.fn();
    const gate = createScheduledTaskGate(setting, report);
    gate.run(cron);
    gate.run(email);
    expect(gate.paused).toBe(false);
    expect(report).not.toHaveBeenCalled();
    expect(cron).toHaveBeenCalledOnce();
    expect(email).toHaveBeenCalledOnce();
    expect(cron.mock.invocationCallOrder[0]).toBeLessThan(email.mock.invocationCallOrder[0]);
  });

  it.each(['true', ' TRUE '])('pausa cron y cola de correo para %s y deja constancia', setting => {
    const report = vi.fn();
    const cron = vi.fn();
    const email = vi.fn();
    const gate = createScheduledTaskGate(setting, report);
    gate.run(cron);
    gate.run(email);
    expect(gate.paused).toBe(true);
    expect(report).toHaveBeenCalledOnce();
    expect(cron).not.toHaveBeenCalled();
    expect(email).not.toHaveBeenCalled();
  });

  it.each(['1', 'yes', 'enabled', 'no', 'true,false'])('falla antes de iniciar tareas ante %s', setting => {
    const report = vi.fn();
    const cron = vi.fn();
    expect(() => createScheduledTaskGate(setting, report).run(cron)).toThrow(/SITREP_PAUSE_BACKGROUND_JOBS/);
    expect(report).not.toHaveBeenCalled();
    expect(cron).not.toHaveBeenCalled();
  });

  it('exige reiniciar cada instancia para cambiar de estado', () => {
    const first = createScheduledTaskGate('true', vi.fn());
    const second = createScheduledTaskGate('true', vi.fn());
    const newWorker = createScheduledTaskGate('false', vi.fn());
    const starts = [vi.fn(), vi.fn(), vi.fn()];
    first.run(starts[0]);
    second.run(starts[1]);
    newWorker.run(starts[2]);
    expect(starts.map(start => start.mock.calls.length)).toEqual([0, 0, 1]);
  });
});
