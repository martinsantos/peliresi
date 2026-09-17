import { backfillLegacyDocuments } from '../src/services/legacyDocumentBackfill.service';

const dryRun = process.env.DOCUMENT_BACKFILL_DRY_RUN !== 'false';
backfillLegacyDocuments({ dryRun, limit: Number(process.env.DOCUMENT_BACKFILL_LIMIT || 100) })
  .then(result => { console.log(JSON.stringify(result)); })
  .catch(error => { console.error(error); process.exitCode = 1; });
