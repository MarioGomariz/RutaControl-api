import { Router } from 'express';
import {
  listarServicios,
  obtenerServicio,
  crearServicio,
  actualizarServicio,
  eliminarServicio
} from '../controllers/servicios.controller';
import { authRequired } from '../middlewares/auth.middleware';

const router = Router();

router.get('/', authRequired, listarServicios);
router.get('/:id', authRequired, obtenerServicio);
router.post('/', authRequired, crearServicio);
router.put('/:id', authRequired, actualizarServicio);
router.delete('/:id', authRequired, eliminarServicio);

export default router;
