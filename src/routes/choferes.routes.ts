import { Router } from 'express';
import { authRequired } from '../middlewares/auth.middleware.js';
import { crearChofer, listarChoferes, obtenerChofer } from '../controllers/choferes.controller.js';

const router = Router();

// Protegidas con auth (podés quitar authRequired mientras probás)
router.get('/', authRequired, listarChoferes);
router.get('/:id', authRequired, obtenerChofer);
router.post('/', authRequired, crearChofer);

export default router;
