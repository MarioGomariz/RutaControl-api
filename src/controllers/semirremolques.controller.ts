import { Request, Response } from 'express';
import { pool } from '../db/pool';
import type { Semirremolque } from '../types/semirremolque';

export async function listarSemis(_req: Request, res: Response) {
  try {
    const [rows] = await pool.query('SELECT * FROM semirremolque ORDER BY id DESC');
    res.json(rows as Semirremolque[]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al listar semirremolques' });
  }
}

export async function obtenerSemi(req: Request<{ id: string }>, res: Response) {
  try {
    const { id } = req.params;
    const [rows] = await pool.query('SELECT * FROM semirremolque WHERE id = ? LIMIT 1', [id]);
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
      'nombre','dominio','anio','estado','tipo_servicio','alcance_servicio',
      'vencimiento_rto','vencimiento_visual_externa','vencimiento_visual_interna',
      'vencimiento_espesores','vencimiento_prueba_hidraulica','vencimiento_mangueras','vencimiento_valvula_flujo'
    ];
    for (const k of required) {
      if ((b as any)[k] === undefined || (b as any)[k] === null || (b as any)[k] === '') {
        return res.status(400).json({ error: `Campo obligatorio faltante: ${k}` });
      }
    }

    const [r] = await pool.query(
      `INSERT INTO semirremolque
      (nombre, dominio, anio, estado, tipo_servicio, alcance_servicio,
       vencimiento_rto, vencimiento_visual_externa, vencimiento_visual_interna,
       vencimiento_espesores, vencimiento_prueba_hidraulica, vencimiento_mangueras, vencimiento_valvula_flujo)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        b.nombre, b.dominio, b.anio, b.estado, b.tipo_servicio, b.alcance_servicio,
        b.vencimiento_rto, b.vencimiento_visual_externa, b.vencimiento_visual_interna,
        b.vencimiento_espesores, b.vencimiento_prueba_hidraulica, b.vencimiento_mangueras, b.vencimiento_valvula_flujo
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
      `UPDATE semirremolque SET
        nombre = COALESCE(?, nombre),
        dominio = COALESCE(?, dominio),
        anio = COALESCE(?, anio),
        estado = COALESCE(?, estado),
        tipo_servicio = COALESCE(?, tipo_servicio),
        alcance_servicio = COALESCE(?, alcance_servicio),
        vencimiento_rto = COALESCE(?, vencimiento_rto),
        vencimiento_visual_externa = COALESCE(?, vencimiento_visual_externa),
        vencimiento_visual_interna = COALESCE(?, vencimiento_visual_interna),
        vencimiento_espesores = COALESCE(?, vencimiento_espesores),
        vencimiento_prueba_hidraulica = COALESCE(?, vencimiento_prueba_hidraulica),
        vencimiento_mangueras = COALESCE(?, vencimiento_mangueras),
        vencimiento_valvula_flujo = COALESCE(?, vencimiento_valvula_flujo)
      WHERE id = ?`,
      [
        b.nombre ?? null, b.dominio ?? null, b.anio ?? null, b.estado ?? null,
        b.tipo_servicio ?? null, b.alcance_servicio ?? null,
        b.vencimiento_rto ?? null, b.vencimiento_visual_externa ?? null, b.vencimiento_visual_interna ?? null,
        b.vencimiento_espesores ?? null, b.vencimiento_prueba_hidraulica ?? null, b.vencimiento_mangueras ?? null,
        b.vencimiento_valvula_flujo ?? null, id
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
    const [r] = await pool.query('DELETE FROM semirremolque WHERE id = ?', [id]);
    if ((r as any).affectedRows === 0) return res.status(404).json({ error: 'Semirremolque no encontrado' });
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al eliminar semirremolque' });
  }
}
