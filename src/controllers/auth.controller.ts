import { Request, Response } from 'express';
import { pool } from '../db/pool';
import jwt from 'jsonwebtoken';
import { comparePassword, hashPassword } from '../utils/password';
import type { Usuario } from '../types/usuario';

type LoginBody = { email: string; password: string };

export async function login(req: Request<{}, {}, LoginBody>, res: Response) {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email y password requeridos' });

    const [rows] = await pool.query(
      'SELECT id, email, contrasena, rol_id, activo FROM usuarios WHERE email = ? LIMIT 1',
      [email]
    );
    const user = (rows as Array<Pick<Usuario, 'id' | 'email' | 'contrasena' | 'rol_id'> & { activo: 0 | 1 }>)?.[0];
    if (!user) return res.status(400).json({ error: 'Credenciales inválidas' });
    if (!user.activo) return res.status(403).json({ error: 'Usuario inactivo' });

    const ok = await comparePassword(password, user.contrasena);
    if (!ok) return res.status(400).json({ error: 'Credenciales inválidas' });

    const token = jwt.sign(
      { id: user.id, email: user.email, rol_id: user.rol_id },
      process.env.JWT_SECRET!,
      { expiresIn: '7d' }
    );
    return res.json({ token });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Error al iniciar sesión' });
  }
}

type CreateAdminBody = { email: string; password: string };

export async function createAdmin(req: Request<{}, {}, CreateAdminBody>, res: Response) {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email y password requeridos' });

    const hash = await hashPassword(password);
    const [result] = await pool.query(
      `INSERT INTO usuarios (usuario, email, contrasena, rol_id, activo)
       VALUES (?, ?, ?, 1, 1)`,
      [email, email, hash]
    );
    return res.json({ id: (result as any).insertId });
  } catch (e: any) {
    if (e?.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'Email o usuario ya existe' });
    }
    console.error(e);
    return res.status(500).json({ error: 'Error al crear admin' });
  }
}
