import { Router } from 'express';
import {
  listarViajes,
  obtenerViaje,
  crearViaje,
  actualizarViaje,
  eliminarViaje
} from '../controllers/viajes.controller';
import { authRequired } from '../middlewares/auth.middleware';

const router = Router();

router.get('/', authRequired, listarViajes);
router.get('/:id', authRequired, obtenerViaje);
router.post('/', authRequired, crearViaje);
router.put('/:id', authRequired, actualizarViaje);
router.delete('/:id', authRequired, eliminarViaje);

export default router;
