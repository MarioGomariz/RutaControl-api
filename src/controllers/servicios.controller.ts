import { Request, Response } from 'express';
import { pool } from '../db/pool';
import type { Servicio } from '../types/servicio';

export async function listarServicios(_req: Request, res: Response) {
  try {
    const [rows] = await pool.query('SELECT * FROM servicios ORDER BY id DESC');
    res.json(rows as Servicio[]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al listar servicios' });
  }
}

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

type CrearServicioBody = Servicio;

export async function crearServicio(req: Request<{}, {}, CrearServicioBody>, res: Response) {
  try {
    const { nombre, descripcion, requiere_prueba_hidraulica, requiere_visuales, requiere_valvula_y_mangueras } = req.body;

    const [r] = await pool.query(
      `INSERT INTO servicios
      (nombre, descripcion, requiere_prueba_hidraulica, requiere_visuales, requiere_valvula_y_mangueras)
      VALUES (?, ?, ?, ?, ?)`,
      [
        nombre,
        descripcion ?? null,
        requiere_prueba_hidraulica ? 1 : 0,
        requiere_visuales ? 1 : 0,
        requiere_valvula_y_mangueras ? 1 : 0
      ]
    );
    res.status(201).json({ id: (r as any).insertId });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al crear servicio' });
  }
}

type UpdateServicioBody = Partial<Omit<Servicio, 'id'>>;

export async function actualizarServicio(
  req: Request<{ id: string }, {}, UpdateServicioBody>,
  res: Response
) {
  try {
    const { id } = req.params;
    const b = req.body;

    const [r] = await pool.query(
      `UPDATE servicios SET
        nombre = COALESCE(?, nombre),
        descripcion = COALESCE(?, descripcion),
        requiere_prueba_hidraulica = COALESCE(?, requiere_prueba_hidraulica),
        requiere_visuales = COALESCE(?, requiere_visuales),
        requiere_valvula_y_mangueras = COALESCE(?, requiere_valvula_y_mangueras)
      WHERE id = ?`,
      [
        b.nombre ?? null,
        b.descripcion ?? null,
        typeof b.requiere_prueba_hidraulica === 'boolean' ? (b.requiere_prueba_hidraulica ? 1 : 0) : null,
        typeof b.requiere_visuales === 'boolean' ? (b.requiere_visuales ? 1 : 0) : null,
        typeof b.requiere_valvula_y_mangueras === 'boolean' ? (b.requiere_valvula_y_mangueras ? 1 : 0) : null,
        id
      ]
    );

    if ((r as any).affectedRows === 0) return res.status(404).json({ error: 'Servicio no encontrado' });
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al actualizar servicio' });
  }
}

export async function eliminarServicio(req: Request<{ id: string }>, res: Response) {
  try {
    const { id } = req.params;
    const [r] = await pool.query('DELETE FROM servicios WHERE id = ?', [id]);
    if ((r as any).affectedRows === 0) return res.status(404).json({ error: 'Servicio no encontrado' });
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al eliminar servicio' });
  }
}
