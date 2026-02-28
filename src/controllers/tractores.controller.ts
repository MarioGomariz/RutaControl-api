import { Request, Response } from 'express';
import { prisma } from '../db/prisma.js';
import type { Tractor } from '../types/tractor.js';

export async function listarTractores(_req: Request, res: Response) {
  try {
    const tractores = await prisma.tractor.findMany({
      orderBy: { id: 'desc' }
    });
    
    const rows = tractores.map(t => ({
      ...t,
      vencimiento_rto: t.vencimiento_rto?.toISOString().split('T')[0] || null
    }));
    
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al listar tractores' });
  }
}

export async function obtenerTractor(req: Request<{ id: string }>, res: Response) {
  try {
    const { id } = req.params;
    const t = await prisma.tractor.findUnique({
      where: { id: Number(id) }
    });
    
    if (!t) return res.status(404).json({ error: 'Tractor no encontrado' });
    
    res.json({
      ...t,
      vencimiento_rto: t.vencimiento_rto?.toISOString().split('T')[0] || null
    });
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
    
    const newTractor = await prisma.tractor.create({
      data: {
        marca,
        modelo,
        dominio,
        anio: anio !== null && anio !== undefined ? Number(anio) : null,
        vencimiento_rto: vencimiento_rto ? new Date(vencimiento_rto) : null,
        estado: estado as any,
        tipo_servicio,
        alcance_servicio
      }
    });
    
    console.log('[CREAR_TRACTOR] ✅ Tractor creado exitosamente con ID:', newTractor.id);
    res.status(201).json({ id: newTractor.id });
  } catch (e: any) {
    console.error('[CREAR_TRACTOR] ❌ Error:', e);
    if (e?.code === 'P2002') {
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
    
    const current = await prisma.tractor.findUnique({ where: { id: Number(id) } });
    if (!current) {
      return res.status(404).json({ error: 'Tractor no encontrado' });
    }

    if (b.dominio && b.dominio !== current.dominio) {
      const existing = await prisma.tractor.findUnique({ where: { dominio: b.dominio } });
      if (existing) {
        return res.status(400).json({ 
          error: `Ya existe un tractor con el dominio ${b.dominio} (${existing.marca} ${existing.modelo})` 
        });
      }
    }

    const dataToUpdate: any = {};
    if (b.marca !== undefined) dataToUpdate.marca = b.marca;
    if (b.modelo !== undefined) dataToUpdate.modelo = b.modelo;
    if (b.dominio !== undefined) dataToUpdate.dominio = b.dominio;
    if (b.anio !== undefined) dataToUpdate.anio = b.anio !== null ? Number(b.anio) : null;
    if (b.estado !== undefined) dataToUpdate.estado = b.estado;
    if (b.tipo_servicio !== undefined) dataToUpdate.tipo_servicio = b.tipo_servicio;
    if (b.alcance_servicio !== undefined) dataToUpdate.alcance_servicio = b.alcance_servicio;
    if (b.vencimiento_rto !== undefined) dataToUpdate.vencimiento_rto = b.vencimiento_rto ? new Date(b.vencimiento_rto) : null;

    await prisma.tractor.update({
      where: { id: Number(id) },
      data: dataToUpdate
    });

    console.log('[ACTUALIZAR_TRACTOR] ✅ Tractor actualizado exitosamente');
    res.json({ ok: true });
  } catch (e: any) {
    console.error('[ACTUALIZAR_TRACTOR] ❌ Error:', e);
    if (e?.code === 'P2002') {
      return res.status(400).json({ error: 'Ya existe un tractor con ese dominio' });
    }
    res.status(500).json({ error: 'Error al actualizar tractor' });
  }
}

export async function eliminarTractor(req: Request<{ id: string }>, res: Response) {
  try {
    const { id } = req.params;
    
    const existing = await prisma.tractor.findUnique({ where: { id: Number(id) } });
    if (!existing) return res.status(404).json({ error: 'Tractor no encontrado' });

    await prisma.tractor.delete({
      where: { id: Number(id) }
    });
    
    res.json({ ok: true });
  } catch (e: any) {
    console.error('Error al eliminar tractor:', e);
    if (e.code === 'P2003') {
      return res.status(400).json({ 
        error: 'No se puede eliminar el tractor porque está asignado a uno o más viajes'
      });
    }
    res.status(500).json({ error: 'Error al eliminar tractor' });
  }
}

export async function verificarDominio(req: Request<{ dominio: string }, {}, {}, { excludeId?: string }>, res: Response) {
  try {
    const { dominio } = req.params;
    const { excludeId } = req.query;
    
    // Normalizar dominio: eliminar espacios y convertir a mayúsculas
    const dominioNormalizado = dominio.replace(/\s+/g, '').toUpperCase();
    
    let existing;
    if (excludeId) {
      const results = await prisma.$queryRaw<any[]>`
        SELECT id, marca, modelo, dominio 
        FROM tractores 
        WHERE REPLACE(UPPER(dominio), ' ', '') = ${dominioNormalizado} 
        AND id != ${Number(excludeId)} 
        LIMIT 1
      `;
      existing = results[0];
    } else {
      const results = await prisma.$queryRaw<any[]>`
        SELECT id, marca, modelo, dominio 
        FROM tractores 
        WHERE REPLACE(UPPER(dominio), ' ', '') = ${dominioNormalizado} 
        LIMIT 1
      `;
      existing = results[0];
    }
    
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
