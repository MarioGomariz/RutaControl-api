import { Router } from 'express';
import {
  listarUsuarios,
  obtenerUsuario,
  crearUsuario,
  actualizarUsuario,
  eliminarUsuario,
  buscarUsuarios
} from '../controllers/usuarios.controller.js';
import { authRequired } from '../middlewares/auth.middleware.js';

const router = Router();

// Todos los endpoints de usuarios deberían estar protegidos
// IMPORTANTE: La ruta de búsqueda debe ir antes de /:id para evitar conflictos
router.get('/search', authRequired, buscarUsuarios);
router.get('/', authRequired, listarUsuarios);
router.get('/:id', authRequired, obtenerUsuario);
router.post('/', authRequired, crearUsuario);
router.put('/:id', authRequired, actualizarUsuario);
router.delete('/:id', authRequired, eliminarUsuario);

export default router;
