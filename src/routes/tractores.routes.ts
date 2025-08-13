import { Router } from 'express';
import {
  listarTractores,
  obtenerTractor,
  crearTractor,
  actualizarTractor,
  eliminarTractor
} from '../controllers/tractores.controller.js';
// import { authRequired } from '../middlewares/auth.middleware';

const router = Router();

router.get('/', /*authRequired,*/ listarTractores);
router.get('/:id', /*authRequired,*/ obtenerTractor);
router.post('/', /*authRequired,*/ crearTractor);
router.put('/:id', /*authRequired,*/ actualizarTractor);
router.delete('/:id', /*authRequired,*/ eliminarTractor);

export default router;
