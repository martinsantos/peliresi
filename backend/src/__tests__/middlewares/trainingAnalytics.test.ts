import { afterEach, expect, it, vi } from 'vitest';
import { inTrainingSession } from '../../lib/trainingScope';
vi.mock('../../lib/prisma',()=>({default:{analyticsLog:{createMany:vi.fn()}}}));
vi.mock('../../utils/logger',()=>({default:{error:vi.fn()}}));
vi.mock('../../config/config',()=>({config:{JWT_SECRET:'qa-only'}}));
import { analyticsMiddleware } from '../../middlewares/analytics.middleware';
afterEach(()=>vi.clearAllMocks());
it.each(['/api/auth/login','/api/auth/login/'])('never attaches operational analytics to a reserved school login at %s',path=>{
  const on=vi.fn(),next=vi.fn();analyticsMiddleware({path,body:{email:'admin@capacitacion.invalid'}} as never,{on} as never,next);
  expect(next).toHaveBeenCalledOnce();expect(on).not.toHaveBeenCalled();
});
it('keeps ordinary login analytics and skips already-scoped school requests',()=>{
  const on=vi.fn(),next=vi.fn();analyticsMiddleware({path:'/api/auth/login',body:{email:'ordinary@example.org'}} as never,{on} as never,next);
  expect(on).toHaveBeenCalledWith('finish',expect.any(Function));on.mockClear();
  inTrainingSession(()=>analyticsMiddleware({path:'/api/manifiestos'} as never,{on} as never,next));expect(on).not.toHaveBeenCalled();
});
