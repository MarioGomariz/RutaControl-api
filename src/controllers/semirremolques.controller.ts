import { Request, Response } from 'express';
import { pool } from '../db/pool.js';
import type { Semirremolque } from '../types/semirremolque.js';

export async function listarSemis(_req: Request, res: Response) {
  try {
    const [rows] = await pool.query('SELECT * FROM semirremolques ORDER BY id DESC');
    res.json(rows as Semirremolque[]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al listar semirremolques' });
  }
}

export async function obtenerSemi(req: Request<{ id: string }>, res: Response) {
  try {
    const { id } = req.params;
    const [rows] = await pool.query('SELECT * FROM semirremolques WHERE id = ? LIMIT 1', [id]);
    const row = (rows as any[])[0] as Semirremolque | undefined;
    if (!row) return res.status(404).json({ error: 'Semirremolque no encontrado' });
    res.json(row);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al obtener semirremolque' });
  }
}

type CrearSemiBody = Semirremolque;

export async function crearSemi(req: Request<{}, {}, CrearSemiBody>, res: Response) {
  try {
    const b = req.body;
    const required: Array<keyof CrearSemiBody> = [
      'nombre','dominio','anio','estado','tipoServicio','alcanceServicio',
      'vencimientoRTO','vencimientoVisualExterna','vencimientoVisualInterna',
      'vencimientoEspesores','vencimientoPruebaHidraulica','vencimientoMangueras','vencimientoValvulaFlujo'
    ];
    for (const k of required) {
      if ((b as any)[k] === undefined || (b as any)[k] === null || (b as any)[k] === '') {
        return res.status(400).json({ error: `Campo obligatorio faltante: ${k}` });
      }
    }

    const [r] = await pool.query(
      `INSERT INTO semirremolques
      (nombre, dominio, anio, estado, tipoServicio, alcanceServicio,
       vencimientoRTO, vencimientoVisualExterna, vencimientoVisualInterna,
       vencimientoEspesores, vencimientoPruebaHidraulica, vencimientoMangueras, vencimientoValvulaFlujo,
       observaciones)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        b.nombre, b.dominio, b.anio, b.estado, b.tipoServicio, b.alcanceServicio,
        b.vencimientoRTO, b.vencimientoVisualExterna, b.vencimientoVisualInterna,
        b.vencimientoEspesores, b.vencimientoPruebaHidraulica, b.vencimientoMangueras, b.vencimientoValvulaFlujo,
        b.observaciones ?? null
      ]
    );
    res.status(201).json({ id: (r as any).insertId });
  } catch (e: any) {
    if (e?.code === 'ER_DUP_ENTRY') return res.status(400).json({ error: 'Dominio ya existe' });
    console.error(e);
    res.status(500).json({ error: 'Error al crear semirremolque' });
  }
}

type UpdateSemiBody = Partial<Semirremolque>;

export async function actualizarSemi(
  req: Request<{ id: string }, {}, UpdateSemiBody>,
  res: Response
) {
  try {
    const { id } = req.params;
    const b = req.body;

    const [r] = await pool.query(
      `UPDATE semirremolques SET
        nombre = COALESCE(?, nombre),
        dominio = COALESCE(?, dominio),
        anio = COALESCE(?, anio),
        estado = COALESCE(?, estado),
        tipoServicio = COALESCE(?, tipoServicio),
        alcanceServicio = COALESCE(?, alcanceServicio),
        vencimientoRTO = COALESCE(?, vencimientoRTO),
        vencimientoVisualExterna = COALESCE(?, vencimientoVisualExterna),
        vencimientoVisualInterna = COALESCE(?, vencimientoVisualInterna),
        vencimientoEspesores = COALESCE(?, vencimientoEspesores),
        vencimientoPruebaHidraulica = COALESCE(?, vencimientoPruebaHidraulica),
        vencimientoMangueras = COALESCE(?, vencimientoMangueras),
        vencimientoValvulaFlujo = COALESCE(?, vencimientoValvulaFlujo),
        observaciones = COALESCE(?, observaciones)
      WHERE id = ?`,
      [
        b.nombre ?? null, b.dominio ?? null, b.anio ?? null, b.estado ?? null,
        b.tipoServicio ?? null, b.alcanceServicio ?? null,
        b.vencimientoRTO ?? null, b.vencimientoVisualExterna ?? null, b.vencimientoVisualInterna ?? null,
        b.vencimientoEspesores ?? null, b.vencimientoPruebaHidraulica ?? null, b.vencimientoMangueras ?? null,
        b.vencimientoValvulaFlujo ?? null, b.observaciones ?? null, id
      ]
    );

    if ((r as any).affectedRows === 0) return res.status(404).json({ error: 'Semirremolque no encontrado' });
    res.json({ ok: true });
  } catch (e: any) {
    if (e?.code === 'ER_DUP_ENTRY') return res.status(400).json({ error: 'Dominio en uso' });
    console.error(e);
    res.status(500).json({ error: 'Error al actualizar semirremolque' });
  }
}

export async function eliminarSemi(req: Request<{ id: string }>, res: Response) {
  try {
    const { id } = req.params;
    const [r] = await pool.query('DELETE FROM semirremolques WHERE id = ?', [id]);
    if ((r as any).affectedRows === 0) return res.status(404).json({ error: 'Semirremolque no encontrado' });
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al eliminar semirremolque' });
  }
}
