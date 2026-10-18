import { Router } from 'express';
import rateLimit,{ipKeyGenerator} from 'express-rate-limit';
import { createHash } from 'node:crypto';
import { isAuthenticated,requireFullAccess } from '../middlewares/auth.middleware';
import { AppError } from '../middlewares/errorHandler';
import { empresaEnabled } from '../domain/empresa';
import * as c from '../controllers/empresa.controller';
const router=Router();
router.use((_req,_res,next)=>next(empresaEnabled()?undefined:new AppError('Funcionalidad no disponible',404)));
router.get('/invitaciones/:token',c.getInvitation);
router.post('/invitaciones/:token/aceptar',rateLimit({windowMs:15*60*1000,max:5,standardHeaders:true,legacyHeaders:false,
 message:{success:false,status:429,message:'Demasiados intentos con esta invitación. Esperá 15 minutos antes de reintentar.'},
 // Shared NAT must not let the first five employees block everyone else's invitation.
 // Keep five attempts per IP AND capability, without retaining raw token in the key.
 keyGenerator:req=>ipKeyGenerator(req.ip||'unknown')+':'+createHash('sha256').update(req.params.token||'').digest('hex'),
}),c.acceptInvitation);
router.use(isAuthenticated,requireFullAccess);
router.use((req:any,_res,next)=>next(req.user.impersonatedBy?new AppError('Administrá empresas con tu propia cuenta',403):undefined));
router.get('/',c.listCompanies);
router.post('/',c.addCompany);
router.get('/:id',c.getCompany);
router.put('/:id',c.updateCompany);
router.post('/:id/actividades',c.addCompanyActivity);
router.post('/:id/responsables',c.validateResponsible);
router.post('/:id/establecimientos',c.saveSite);
router.put('/:id/establecimientos/:siteId',c.saveSite);
router.post('/:id/personas',c.addPerson);
router.post('/:id/personas/:grantId/revocar',c.revokePerson);
router.post('/:id/invitaciones',c.invitePerson);
router.post('/:id/invitaciones/:inviteId/revocar',c.revokeInvitation);
export default router;
