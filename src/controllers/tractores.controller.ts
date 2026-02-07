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
    console.log('[CREAR_TRACTOR] Iniciando creación con dominio:', dominio);
    
    // Verificar si ya existe un tractor con ese dominio
    console.log('[CREAR_TRACTOR] Verificando duplicados para dominio:', dominio);
    const [[existing]]: any = await pool.query(
      'SELECT id, marca, modelo FROM tractores WHERE dominio = ? LIMIT 1',
      [dominio]
    );
    
    if (existing) {
      console.log('[CREAR_TRACTOR] ❌ Duplicado encontrado:', existing);
      return res.status(400).json({ 
        error: `Ya existe un tractor con el dominio ${dominio} (${existing.marca} ${existing.modelo})` 
      });
    }
    
    console.log('[CREAR_TRACTOR] ✅ No hay duplicados, procediendo a crear');
    
    const rtoDate = toSqlDate(vencimiento_rto);
    const [r] = await pool.query(
      `INSERT INTO tractores
      (marca, modelo, dominio, anio, vencimiento_rto, estado, tipo_servicio, alcance_servicio)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [marca, modelo, dominio, anio, rtoDate, estado, tipo_servicio, alcance_servicio]
    );
    const newId = (r as any).insertId;
    console.log('[CREAR_TRACTOR] ✅ Tractor creado exitosamente con ID:', newId);
    res.status(201).json({ id: newId });
  } catch (e: any) {
    console.error('[CREAR_TRACTOR] ❌ Error:', e);
    if (e?.code === 'ER_DUP_ENTRY') {
      console.log('[CREAR_TRACTOR] Error de duplicado en BD');
      return res.status(400).json({ error: 'Ya existe un tractor con ese dominio' });
    }
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
    console.log('[ACTUALIZAR_TRACTOR] Iniciando actualización para ID:', id);
    console.log('[ACTUALIZAR_TRACTOR] Datos recibidos:', b);
    
    // Si se está actualizando el dominio, verificar duplicados
    if (b.dominio) {
      console.log('[ACTUALIZAR_TRACTOR] Verificando duplicados para dominio:', b.dominio);
      const [[existing]]: any = await pool.query(
        'SELECT id, marca, modelo FROM tractores WHERE dominio = ? AND id != ? LIMIT 1',
        [b.dominio, id]
      );
      
      if (existing) {
        console.log('[ACTUALIZAR_TRACTOR] ❌ Duplicado encontrado:', existing);
        return res.status(400).json({ 
          error: `Ya existe un tractor con el dominio ${b.dominio} (${existing.marca} ${existing.modelo})` 
        });
      }
      console.log('[ACTUALIZAR_TRACTOR] ✅ No hay duplicados');
    }
    
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

    if ((r as any).affectedRows === 0) {
      console.log('[ACTUALIZAR_TRACTOR] ❌ Tractor no encontrado con ID:', id);
      return res.status(404).json({ error: 'Tractor no encontrado' });
    }
    console.log('[ACTUALIZAR_TRACTOR] ✅ Tractor actualizado exitosamente');
    res.json({ ok: true });
  } catch (e: any) {
    console.error('[ACTUALIZAR_TRACTOR] ❌ Error:', e);
    if (e?.code === 'ER_DUP_ENTRY') {
      console.log('[ACTUALIZAR_TRACTOR] Error de duplicado en BD');
      return res.status(400).json({ error: 'Ya existe un tractor con ese dominio' });
    }
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

/**
 * Verifica si un dominio ya existe en la base de datos
 * Se usa para validación en tiempo real en el formulario
 */
export async function verificarDominio(req: Request<{ dominio: string }, {}, {}, { excludeId?: string }>, res: Response) {
  try {
    const { dominio } = req.params;
    const { excludeId } = req.query;
    
    let query = 'SELECT id, marca, modelo FROM tractores WHERE dominio = ? LIMIT 1';
    const params: any[] = [dominio];
    
    // Si se proporciona excludeId, excluir ese registro (para modo edición)
    if (excludeId) {
      query = 'SELECT id, marca, modelo FROM tractores WHERE dominio = ? AND id != ? LIMIT 1';
      params.push(excludeId);
    }
    
    const [[existing]]: any = await pool.query(query, params);
    
    if (existing) {
      return res.json({ 
        exists: true, 
        id: existing.id,
        info: `${existing.marca} ${existing.modelo}`
      });
    }
    
    res.json({ exists: false });
  } catch (e) {
    console.error('Error al verificar dominio:', e);
    res.status(500).json({ error: 'Error al verificar dominio' });
  }
}
