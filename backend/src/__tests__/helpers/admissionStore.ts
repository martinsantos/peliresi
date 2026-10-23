import { admissionKey, type AdmissionReceipt, type AdmissionStore } from '../../services/apiAdmission.service';

/** Deterministic fixture only. Production always uses PostgreSQL. */
export class TestAdmissionStore implements AdmissionStore {
  now = Date.now();
  rows = new Map<string, AdmissionReceipt>();
  async consume(namespace: string, identity: string, windowMs: number) {
    const key = admissionKey(namespace, identity);
    const prior = this.rows.get(key);
    const resetAt = prior && prior.resetAt.getTime() > this.now ? prior.resetAt : new Date(this.now + windowMs);
    const hits = prior && prior.resetAt === resetAt ? prior.hits + 1 : 1;
    const receipt = { key, hits, resetAt, retryAfterSeconds: Math.max(1, Math.ceil((resetAt.getTime() - this.now) / 1000)) };
    this.rows.set(key, receipt);
    return { ...receipt };
  }
  async release(receipt: AdmissionReceipt) {
    const current = this.rows.get(receipt.key);
    if (current?.resetAt.getTime() === receipt.resetAt.getTime()) current.hits = Math.max(0, current.hits - 1);
  }
}
