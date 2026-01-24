import { Request, Response } from 'express';
import { pool } from '../db/pool.js';
import type { Servicio } from '../types/servicio.js';

/**
 * Listar servicios
 * Solo hay 2 servicios fijos: Gas Líquido y Combustible Líquido
 * No se permite crear, actualizar o eliminar servicios
 */
export async function listarServicios(_req: Request, res: Response) {
  try {
    const [rows] = await pool.query('SELECT * FROM servicios ORDER BY id ASC');
    res.json(rows as Servicio[]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al listar servicios' });
  }
}

/**
 * Obtener un servicio por ID
 * Útil para validaciones y referencias
 */
export async function obtenerServicio(req: Request<{ id: string }>, res: Response) {
  try {
    const { id } = req.params;
    const [rows] = await pool.query('SELECT * FROM servicios WHERE id = ? LIMIT 1', [id]);
    const row = (rows as any[])[0] as Servicio | undefined;
    if (!row) return res.status(404).json({ error: 'Servicio no encontrado' });
    res.json(row);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al obtener servicio' });
  }
}
