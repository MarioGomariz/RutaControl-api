import { Request, Response } from 'express';
import { pool } from '../db/pool.js';
import type { Tractor } from '../types/tractor.js';
import { toSqlDate } from '../helpers/dateTransforme.js';

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
    const { marca, modelo, dominio, anio, vencimiento_rto, estado, tipo_servicio, alcance_servicio } = req.body;
    const rtoDate = toSqlDate(vencimiento_rto);
    const [r] = await pool.query(
      `INSERT INTO tractores
      (marca, modelo, dominio, anio, vencimiento_rto, estado, tipo_servicio, alcance_servicio)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [marca, modelo, dominio, anio, rtoDate, estado, tipo_servicio, alcance_servicio]
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
    const rtoDate = toSqlDate(b.vencimiento_rto);

    const [r] = await pool.query(
      `UPDATE tractores SET
        marca = COALESCE(?, marca),
        modelo = COALESCE(?, modelo),
        dominio = COALESCE(?, dominio),
        anio = COALESCE(?, anio),
        vencimiento_rto = COALESCE(?, vencimiento_rto),
        estado = COALESCE(?, estado),
        tipo_servicio = COALESCE(?, tipo_servicio),
        alcance_servicio = COALESCE(?, alcance_servicio)
      WHERE id = ?`,
      [
        b.marca ?? null, b.modelo ?? null, b.dominio ?? null, b.anio ?? null,
        rtoDate ?? null, b.estado ?? null, b.tipo_servicio ?? null,
        b.alcance_servicio ?? null, id
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
  } catch (e: any) {
    console.error('Error al eliminar tractor:', e);
    
    // Detectar error de restricción de clave foránea
    if (e?.code === 'ER_ROW_IS_REFERENCED_2' || e?.errno === 1451) {
      return res.status(400).json({ 
        error: 'No se puede eliminar el tractor porque está asignado a uno o más viajes',
        code: e.code,
        sqlMessage: e.sqlMessage
      });
    }
    return res.status(500).json({ error: 'Error al eliminar tractor' });
  }
}
