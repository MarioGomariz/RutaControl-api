import { Router } from 'express';
import {
  listarSemis,
  obtenerSemi,
  crearSemi,
  actualizarSemi,
  eliminarSemi,
  verificarDominioSemi
} from '../controllers/semirremolques.controller.js';
import { authRequired } from '../middlewares/auth.middleware.js';

const router = Router();

router.get('/', authRequired, listarSemis);
router.get('/check-dominio/:dominio', authRequired, verificarDominioSemi);
router.get('/:id', authRequired, obtenerSemi);
router.post('/', authRequired, crearSemi);
router.put('/:id', authRequired, actualizarSemi);
router.delete('/:id', authRequired, eliminarSemi);

export default router;
