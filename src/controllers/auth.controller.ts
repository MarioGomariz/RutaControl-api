import { Request, Response } from 'express';
import { pool } from '../db/pool.js';
import jwt from 'jsonwebtoken';
import { comparePassword, hashPassword } from '../utils/password.js';
import type { Usuario } from '../types/usuario.js';

type LoginBody = { usuario: string; password: string };

export async function login(req: Request<{}, {}, LoginBody>, res: Response) {
  try {
    const { usuario, password } = req.body;
    if (!usuario || !password) return res.status(400).json({ error: 'Usuario y password requeridos' });

    const [rows] = await pool.query(
      'SELECT * FROM usuario WHERE usuario = ? LIMIT 1',
      [usuario]
    );
    const user = (rows as Array<Usuario>)?.[0];
    if (!user) return res.status(400).json({ error: 'Credenciales inválidas' });
    if (!user.activo) return res.status(403).json({ error: 'Usuario inactivo' });

    const ok = await comparePassword(password, user.contrasena);
    if (!ok) return res.status(400).json({ error: 'Credenciales inválidas' });

    const token = jwt.sign(
      { id: user.id, usuario: user.usuario, rol_id: user.rol_id },
      process.env.JWT_SECRET!,
      { expiresIn: '7d' }
    );
    return res.json({ token });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Error al iniciar sesión' });
  }
}

type CreateAdminBody = { usuario: string; password: string };

export async function createAdmin(req: Request<{}, {}, CreateAdminBody>, res: Response) {
  try {
    const { usuario, password } = req.body;
    if (!usuario || !password) return res.status(400).json({ error: 'Usuario y password requeridos' });

    const hash = await hashPassword(password);
    const [result] = await pool.query(
      `INSERT INTO usuario (usuario, contrasena, rol_id, activo)
       VALUES (?, ?, 1, 1)`,
      [usuario, hash]
    );
    return res.json({ id: (result as any).insertId });
  } catch (e: any) {
    if (e?.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'Usuario ya existe' });
    }
    console.error(e);
    return res.status(500).json({ error: 'Error al crear admin' });
  }
}
