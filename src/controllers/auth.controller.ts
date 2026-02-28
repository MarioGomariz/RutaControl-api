import { Request, Response } from 'express';
import { prisma } from '../db/prisma.js';
import jwt from 'jsonwebtoken';
import { comparePassword, hashPassword } from '../utils/password.js';

type LoginBody = { usuario: string; password: string };

export async function login(req: Request<{}, {}, LoginBody>, res: Response) {
  try {
    const { usuario, password } = req.body;
    console.log('[LOGIN] Intento de login para usuario:', usuario);
    
    if (!usuario || !password) {
      console.log('[LOGIN] Error: Faltan credenciales');
      return res.status(400).json({ error: 'Usuario y password requeridos' });
    }

    const user = await prisma.usuario.findUnique({
      where: { usuario }
    });
    
    if (!user) {
      console.log('[LOGIN] Error: Usuario no encontrado:', usuario);
      return res.status(400).json({ error: 'Credenciales inválidas' });
    }
    
    console.log('[LOGIN] Usuario encontrado, ID:', user.id, 'Activo:', user.activo);
    
    if (!user.activo) {
      console.log('[LOGIN] Error: Usuario inactivo');
      return res.status(403).json({ error: 'Usuario inactivo' });
    }

    // Si es chofer (rol_id = 2), verificar estado. El email del chofer es igual al usuario.
    if (user.rol_id === 2) {
      const chofer = await prisma.chofer.findUnique({
        where: { email: user.usuario }
      });
      
      if (chofer && !chofer.activo) {
        console.log('[LOGIN] Error: Chofer inactivo');
        return res.status(403).json({ error: 'Chofer inactivo. No puede iniciar sesión.' });
      }
    }

    console.log('[LOGIN] Comparando contraseñas...');
    const ok = await comparePassword(password, user.contrasena);
    console.log('[LOGIN] Resultado de comparación:', ok);
    
    if (!ok) {
      console.log('[LOGIN] Error: Contraseña incorrecta');
      return res.status(400).json({ error: 'Credenciales inválidas' });
    }

    console.log('[LOGIN] Login exitoso para usuario:', usuario);
    const token = jwt.sign(
      { id: user.id, usuario: user.usuario, rol_id: user.rol_id },
      process.env.JWT_SECRET!,
      { expiresIn: '7d' }
    );
    return res.json({ token });
  } catch (e) {
    console.error('[LOGIN] Error inesperado:', e);
    return res.status(500).json({ error: 'Error al iniciar sesión' });
  }
}

type CreateAdminBody = { usuario: string; password: string };

export async function createAdmin(req: Request<{}, {}, CreateAdminBody>, res: Response) {
  try {
    const { usuario, password } = req.body;
    if (!usuario || !password) return res.status(400).json({ error: 'Usuario y password requeridos' });

    const hash = await hashPassword(password);
    const result = await prisma.usuario.create({
      data: {
        usuario,
        contrasena: hash,
        rol_id: 1,
        activo: true
      }
    });

    return res.json({ id: result.id });
  } catch (e: any) {
    if (e?.code === 'P2002') {
      return res.status(400).json({ error: 'Usuario ya existe' });
    }
    console.error(e);
    return res.status(500).json({ error: 'Error al crear admin' });
  }
}
