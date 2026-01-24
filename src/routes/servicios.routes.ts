import { Router } from 'express';
import {
  listarServicios,
  obtenerServicio
} from '../controllers/servicios.controller.js';
import { authRequired } from '../middlewares/auth.middleware.js';

const router = Router();

// Solo endpoints de lectura - Los servicios son fijos (Gas Líquido y Combustible Líquido)
router.get('/', authRequired, listarServicios);
router.get('/:id', authRequired, obtenerServicio);

export default router;
