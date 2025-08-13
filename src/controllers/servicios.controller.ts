import { Request, Response } from 'express';
import { pool } from '../db/pool.js';
import type { Servicio } from '../types/servicio.js';

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
    const b = req.body;
    if (
      !b.nombre ||
      typeof b.requierePruebaHidraulica !== 'boolean' ||
      typeof b.requiereVisuales !== 'boolean' ||
      typeof b.requiereValvulaYMangueras !== 'boolean'
    ) return res.status(400).json({ error: 'Campos obligatorios faltantes' });

    const [r] = await pool.query(
      `INSERT INTO servicios
      (nombre, descripcion, requierePruebaHidraulica, requiereVisuales, requiereValvulaYMangueras, observaciones)
      VALUES (?, ?, ?, ?, ?, ?)`,
      [
        b.nombre,
        b.descripcion ?? null,
        b.requierePruebaHidraulica ? 1 : 0,
        b.requiereVisuales ? 1 : 0,
        b.requiereValvulaYMangueras ? 1 : 0,
        b.observaciones ?? null
      ]
    );
    res.status(201).json({ id: (r as any).insertId });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al crear servicio' });
  }
}

type UpdateServicioBody = Partial<Servicio>;

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
        descripcion = ?,
        requierePruebaHidraulica = COALESCE(?, requierePruebaHidraulica),
        requiereVisuales = COALESCE(?, requiereVisuales),
        requiereValvulaYMangueras = COALESCE(?, requiereValvulaYMangueras),
        observaciones = ?
      WHERE id = ?`,
      [
        b.nombre ?? null,
        b.descripcion ?? null,
        typeof b.requierePruebaHidraulica === 'boolean' ? (b.requierePruebaHidraulica ? 1 : 0) : null,
        typeof b.requiereVisuales === 'boolean' ? (b.requiereVisuales ? 1 : 0) : null,
        typeof b.requiereValvulaYMangueras === 'boolean' ? (b.requiereValvulaYMangueras ? 1 : 0) : null,
        b.observaciones ?? null,
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
