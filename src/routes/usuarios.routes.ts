import { Router } from 'express';
import {
  listarUsuarios,
  obtenerUsuario,
  crearUsuario,
  actualizarUsuario,
  eliminarUsuario
} from '../controllers/usuarios.controller';
import { authRequired } from '../middlewares/auth.middleware';

const router = Router();

// Todos los endpoints de usuarios deberían estar protegidos
router.get('/', authRequired, listarUsuarios);
router.get('/:id', authRequired, obtenerUsuario);
router.post('/', authRequired, crearUsuario);
router.put('/:id', authRequired, actualizarUsuario);
router.delete('/:id', authRequired, eliminarUsuario);

export default router;
