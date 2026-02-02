import { Request, Response } from 'express';
import { pool } from '../db/pool.js';
import { toSqlDate } from '../helpers/dateTransforme.js';
import type { Semirremolque } from '../types/semirremolque.js';

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
    // Campos básicos siempre requeridos
    const basicRequired: Array<keyof CrearSemiBody> = [
      'nombre','dominio','anio','estado','tipo_servicio','alcance_servicio'
    ];
    for (const k of basicRequired) {
      if ((b as any)[k] === undefined || (b as any)[k] === null || (b as any)[k] === '') {
        return res.status(400).json({ error: `Campo obligatorio faltante: ${k}` });
      }
    }
    
    // Verificar si ya existe un semirremolque con ese dominio
    const [[existing]]: any = await pool.query(
      'SELECT id, nombre FROM semirremolque WHERE dominio = ? LIMIT 1',
      [b.dominio]
    );
    if (existing) {
      return res.status(400).json({ 
        error: `Ya existe un semirremolque con el dominio ${b.dominio} (${existing.nombre})` 
      });
    }
    
    // Validar campos de documentación según tipo de servicio
    const tipoServicio = b.tipo_servicio?.toLowerCase();
    if (tipoServicio === 'gas líquido' || tipoServicio === 'gas licuado') {
      // Requiere: mangueras, prueba hidráulica, válvula de flujo
      const gasRequired = ['vencimiento_mangueras', 'vencimiento_prueba_hidraulica', 'vencimiento_valvula_flujo'];
      for (const k of gasRequired) {
        if (!(b as any)[k]) {
          return res.status(400).json({ error: `Campo obligatorio para Gas Líquido: ${k}` });
        }
      }
    } else if (tipoServicio === 'combustible líquido') {
      // Requiere: RTO, visual externa, visual interna, espesores
      const combustibleRequired = ['vencimiento_rto', 'vencimiento_visual_externa', 'vencimiento_visual_interna', 'vencimiento_espesores'];
      for (const k of combustibleRequired) {
        if (!(b as any)[k]) {
          return res.status(400).json({ error: `Campo obligatorio para Combustible Líquido: ${k}` });
        }
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
        toSqlDate(b.vencimiento_rto), toSqlDate(b.vencimiento_visual_externa), toSqlDate(b.vencimiento_visual_interna),
        toSqlDate(b.vencimiento_espesores), toSqlDate(b.vencimiento_prueba_hidraulica), toSqlDate(b.vencimiento_mangueras), toSqlDate(b.vencimiento_valvula_flujo)
      ]
    );
    res.status(201).json({ id: (r as any).insertId });
  } catch (e: any) {
    if (e?.code === 'ER_DUP_ENTRY') return res.status(400).json({ error: 'Ya existe un semirremolque con ese dominio' });
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
    
    // Si se está actualizando el dominio, verificar duplicados
    if (b.dominio) {
      const [[existing]]: any = await pool.query(
        'SELECT id, nombre FROM semirremolque WHERE dominio = ? AND id != ? LIMIT 1',
        [b.dominio, id]
      );
      if (existing) {
        return res.status(400).json({ 
          error: `Ya existe un semirremolque con el dominio ${b.dominio} (${existing.nombre})` 
        });
      }
    }

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
        toSqlDate(b.vencimiento_rto) ?? null, toSqlDate(b.vencimiento_visual_externa) ?? null, toSqlDate(b.vencimiento_visual_interna) ?? null,
        toSqlDate(b.vencimiento_espesores) ?? null, toSqlDate(b.vencimiento_prueba_hidraulica) ?? null, toSqlDate(b.vencimiento_mangueras) ?? null,
        toSqlDate(b.vencimiento_valvula_flujo) ?? null, id
      ]
    );

    if ((r as any).affectedRows === 0) return res.status(404).json({ error: 'Semirremolque no encontrado' });
    res.json({ ok: true });
  } catch (e: any) {
    if (e?.code === 'ER_DUP_ENTRY') return res.status(400).json({ error: 'Ya existe un semirremolque con ese dominio' });
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
  } catch (e: any) {
    console.error('Error al eliminar semirremolque:', e);
    
    // Detectar error de restricción de clave foránea
    if (e?.code === 'ER_ROW_IS_REFERENCED_2' || e?.errno === 1451) {
      return res.status(400).json({ 
        error: 'No se puede eliminar el semirremolque porque está asignado a uno o más viajes',
        code: e.code,
        sqlMessage: e.sqlMessage
      });
    }
    return res.status(500).json({ error: 'Error al eliminar semirremolque' });
  }
}
