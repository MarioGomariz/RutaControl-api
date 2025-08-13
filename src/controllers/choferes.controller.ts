import { Request, Response } from 'express';
import { pool } from '../db/pool.js';
import { hashPassword } from '../utils/password.js';
import crypto from 'crypto';
import type { Chofer } from '../types/chofer.js';

type CrearChoferBody = Chofer; // viene todo desde el front (sin id/usuario_id)

export async function crearChofer(
  req: Request<{}, {}, CrearChoferBody>,
  res: Response
) {
  const body = req.body;

  // Validación mínima
  const required: Array<keyof CrearChoferBody> = [
    'nombre', 'apellido', 'dni', 'telefono', 'email', 'licencia', 'fecha_vencimiento_licencia', 'estado'
  ];
  for (const k of required) {
    if (body[k] === undefined || body[k] === null || body[k] === '')
      return res.status(400).json({ error: `Campo obligatorio faltante: ${k}` });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Chequear rol 2
    const [r2] = await conn.query('SELECT id FROM roles WHERE id = 2');
    if ((r2 as any[]).length === 0) throw new Error('No existe el rol 2 (chofer). Seed faltante.');

    // Duplicados
    const [[dupU]]: any = await conn.query('SELECT id FROM usuarios WHERE email = ? LIMIT 1', [body.email]);
    if (dupU) throw new Error('El email ya está registrado en usuarios');

    const [[dupC]]: any = await conn.query('SELECT id FROM choferes WHERE dni = ? OR email = ? LIMIT 1', [body.dni, body.email]);
    if (dupC) throw new Error('DNI o email ya existente en choferes');

    // Password temporal (en prod: enviar flujo de seteo)
    const temp = crypto.randomUUID().slice(0, 10);
    const hash = await hashPassword(temp);

    // Usuario (rol 2)
    const [uRes] = await conn.query(
      `INSERT INTO usuarios (usuario, email, contrasena, rol_id, activo)
       VALUES (?, ?, ?, 2, 1)`,
      [body.email, body.email, hash]
    );
    const usuarioId = (uRes as any).insertId;

    // Chofer
    const [cRes] = await conn.query(
      `INSERT INTO choferes
      (usuario_id, nombre, apellido, dni, telefono, email, licencia, fecha_vencimiento_licencia, estado)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        usuarioId,
        body.nombre,
        body.apellido,
        body.dni,
        body.telefono,
        body.email,
        body.licencia,
        body.fecha_vencimiento_licencia,
        body.estado ? 1 : 0
      ]
    );

    await conn.commit();
    return res.status(201).json({
      chofer_id: (cRes as any).insertId,
      usuario_id: usuarioId,
      password_temporal: temp // solo dev para testear
    });
  } catch (e: any) {
    await conn.rollback();
    if (e?.message) return res.status(400).json({ error: e.message });
    console.error(e);
    return res.status(500).json({ error: 'Error al crear chofer' });
  } finally {
    conn.release();
  }
}

export async function listarChoferes(_req: Request, res: Response) {
  try {
    const [rows] = await pool.query(
      `SELECT c.*, u.email AS login_email, u.rol_id
       FROM choferes c
       JOIN usuarios u ON u.id = c.usuario_id
       ORDER BY c.id DESC`
    );
    res.json(rows as Chofer[]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al listar choferes' });
  }
}

export async function obtenerChofer(req: Request<{ id: string }>, res: Response) {
  try {
    const { id } = req.params;
    const [rows] = await pool.query(
      `SELECT c.*, u.email AS login_email, u.rol_id
       FROM choferes c
       JOIN usuarios u ON u.id = c.usuario_id
       WHERE c.id = ? LIMIT 1`,
      [id]
    );
    const row = (rows as any[])[0] as Chofer | undefined;
    if (!row) return res.status(404).json({ error: 'Chofer no encontrado' });
    res.json(row);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al obtener chofer' });
  }
}
