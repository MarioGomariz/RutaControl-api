import { Request, Response } from 'express';
import { pool } from '../db/pool';
import type { Tractor } from '../types/tractor';

export async function listarTractores(_req: Request, res: Response) {
  try {
    const [rows] = await pool.query('SELECT * FROM tractores ORDER BY id DESC');
    res.json(rows as Tractor[]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al listar tractores' });
  }
}

export async function obtenerTractor(req: Request<{ id: string }>, res: Response) {
  try {
    const { id } = req.params;
    const [rows] = await pool.query('SELECT * FROM tractores WHERE id = ? LIMIT 1', [id]);
    const row = (rows as any[])[0] as Tractor | undefined;
    if (!row) return res.status(404).json({ error: 'Tractor no encontrado' });
    res.json(row);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al obtener tractor' });
  }
}

type CrearTractorBody = Tractor;

export async function crearTractor(req: Request<{}, {}, CrearTractorBody>, res: Response) {
  try {
    const b = req.body;
    if (!b.marca || !b.modelo || !b.dominio || !b.anio || !b.vencimientoRTO || !b.estado || !b.tipoServicio || !b.alcanceServicio) {
      return res.status(400).json({ error: 'Campos obligatorios faltantes' });
    }

    const [r] = await pool.query(
      `INSERT INTO tractores
      (marca, modelo, dominio, anio, vencimientoRTO, estado, tipoServicio, alcanceServicio, observaciones)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [b.marca, b.modelo, b.dominio, b.anio, b.vencimientoRTO, b.estado, b.tipoServicio, b.alcanceServicio, b.observaciones ?? null]
    );
    res.status(201).json({ id: (r as any).insertId });
  } catch (e: any) {
    if (e?.code === 'ER_DUP_ENTRY') return res.status(400).json({ error: 'Dominio ya existe' });
    console.error(e);
    res.status(500).json({ error: 'Error al crear tractor' });
  }
}

type UpdateTractorBody = Partial<Tractor>;

export async function actualizarTractor(
  req: Request<{ id: string }, {}, UpdateTractorBody>,
  res: Response
) {
  try {
    const { id } = req.params;
    const b = req.body;

    const [r] = await pool.query(
      `UPDATE tractores SET
        marca = COALESCE(?, marca),
        modelo = COALESCE(?, modelo),
        dominio = COALESCE(?, dominio),
        anio = COALESCE(?, anio),
        vencimientoRTO = COALESCE(?, vencimientoRTO),
        estado = COALESCE(?, estado),
        tipoServicio = COALESCE(?, tipoServicio),
        alcanceServicio = COALESCE(?, alcanceServicio),
        observaciones = COALESCE(?, observaciones)
      WHERE id = ?`,
      [
        b.marca ?? null, b.modelo ?? null, b.dominio ?? null, b.anio ?? null,
        b.vencimientoRTO ?? null, b.estado ?? null, b.tipoServicio ?? null,
        b.alcanceServicio ?? null, b.observaciones ?? null, id
      ]
    );

    if ((r as any).affectedRows === 0) return res.status(404).json({ error: 'Tractor no encontrado' });
    res.json({ ok: true });
  } catch (e: any) {
    if (e?.code === 'ER_DUP_ENTRY') return res.status(400).json({ error: 'Dominio en uso' });
    console.error(e);
    res.status(500).json({ error: 'Error al actualizar tractor' });
  }
}

export async function eliminarTractor(req: Request<{ id: string }>, res: Response) {
  try {
    const { id } = req.params;
    const [r] = await pool.query('DELETE FROM tractores WHERE id = ?', [id]);
    if ((r as any).affectedRows === 0) return res.status(404).json({ error: 'Tractor no encontrado' });
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al eliminar tractor' });
  }
}
