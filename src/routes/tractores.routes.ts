import { Router } from 'express';
import {
  listarTractores,
  obtenerTractor,
  crearTractor,
  actualizarTractor,
  eliminarTractor,
  verificarDominio
} from '../controllers/tractores.controller.js';
import { authRequired } from '../middlewares/auth.middleware.js';

const router = Router();

router.get('/', authRequired, listarTractores);
router.get('/check-dominio/:dominio', authRequired, verificarDominio);
router.get('/:id', authRequired, obtenerTractor);
router.post('/', authRequired, crearTractor);
router.put('/:id', authRequired, actualizarTractor);
router.delete('/:id', authRequired, eliminarTractor);

export default router;
