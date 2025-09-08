import { Router } from 'express';
import { authRequired } from '../middlewares/auth.middleware';
import { crearChofer, listarChoferes, obtenerChofer, actualizarChofer, eliminarChofer } from '../controllers/choferes.controller';

const router = Router();

// Protegidas con auth (podés quitar authRequired mientras probás)
router.get('/', authRequired, listarChoferes);
router.get('/:id', authRequired, obtenerChofer);
router.post('/', authRequired, crearChofer);
router.put('/:id', authRequired, actualizarChofer);
router.delete('/:id', authRequired, eliminarChofer);

export default router;
