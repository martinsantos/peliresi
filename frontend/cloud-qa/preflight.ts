import { assertCloudDatabase } from './safety.ts';
await assertCloudDatabase();
console.log('Cloud database identity verified before Prisma schema writes');
