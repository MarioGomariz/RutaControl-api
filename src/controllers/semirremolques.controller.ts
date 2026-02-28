import { Request, Response } from 'express';
import { prisma } from '../db/prisma.js';
import { Prisma } from '@prisma/client';
import type { Semirremolque } from '../types/semirremolque.js';

export async function listarSemis(_req: Request, res: Response) {
  try {
    const semis = await prisma.semirremolque.findMany({
      orderBy: { id: 'desc' }
    });
    
    const rows = semis.map(s => ({
      ...s,
      vencimiento_rto: s.vencimiento_rto?.toISOString().split('T')[0] || null,
      vencimiento_visual_externa: s.vencimiento_visual_externa?.toISOString().split('T')[0] || null,
      vencimiento_visual_interna: s.vencimiento_visual_interna?.toISOString().split('T')[0] || null,
      vencimiento_espesores: s.vencimiento_espesores?.toISOString().split('T')[0] || null,
      vencimiento_prueba_hidraulica: s.vencimiento_prueba_hidraulica?.toISOString().split('T')[0] || null,
      vencimiento_mangueras: s.vencimiento_mangueras?.toISOString().split('T')[0] || null,
      vencimiento_valvula_flujo: s.vencimiento_valvula_flujo?.toISOString().split('T')[0] || null,
    }));
    
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al listar semirremolques' });
  }
}

export async function obtenerSemi(req: Request<{ id: string }>, res: Response) {
  try {
    const { id } = req.params;
    const s = await prisma.semirremolque.findUnique({
      where: { id: Number(id) }
    });
    
    if (!s) return res.status(404).json({ error: 'Semirremolque no encontrado' });
    
    res.json({
      ...s,
      vencimiento_rto: s.vencimiento_rto?.toISOString().split('T')[0] || null,
      vencimiento_visual_externa: s.vencimiento_visual_externa?.toISOString().split('T')[0] || null,
      vencimiento_visual_interna: s.vencimiento_visual_interna?.toISOString().split('T')[0] || null,
      vencimiento_espesores: s.vencimiento_espesores?.toISOString().split('T')[0] || null,
      vencimiento_prueba_hidraulica: s.vencimiento_prueba_hidraulica?.toISOString().split('T')[0] || null,
      vencimiento_mangueras: s.vencimiento_mangueras?.toISOString().split('T')[0] || null,
      vencimiento_valvula_flujo: s.vencimiento_valvula_flujo?.toISOString().split('T')[0] || null,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al obtener semirremolque' });
  }
}

type CrearSemiBody = Semirremolque;

export async function crearSemi(req: Request<{}, {}, CrearSemiBody>, res: Response) {
  try {
    const b = req.body;
    console.log('[CREAR_SEMI] Iniciando creación con dominio:', b.dominio);
    
    // Campos básicos siempre requeridos
    const basicRequired: Array<keyof CrearSemiBody> = [
      'nombre','dominio','anio','estado','tipo_servicio','alcance_servicio'
    ];
    for (const k of basicRequired) {
      if ((b as any)[k] === undefined || (b as any)[k] === null || (b as any)[k] === '') {
        console.log('[CREAR_SEMI] ❌ Campo faltante:', k);
        return res.status(400).json({ error: `Campo obligatorio faltante: ${k}` });
      }
    }
    
    // Validar campos de documentación según tipo de servicio
    const tipoServicio = b.tipo_servicio 
      ? b.tipo_servicio.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") 
      : '';
      
    if (tipoServicio === 'gas liquido' || tipoServicio === 'gas licuado') {
      const gasRequired = ['vencimiento_mangueras', 'vencimiento_prueba_hidraulica', 'vencimiento_valvula_flujo'];
      for (const k of gasRequired) {
        if (!(b as any)[k]) {
          return res.status(400).json({ error: `Campo obligatorio para Gas Licuado: ${k}` });
        }
      }
    } else if (tipoServicio === 'combustible liquido') {
      const combustibleRequired = ['vencimiento_rto', 'vencimiento_visual_externa', 'vencimiento_visual_interna', 'vencimiento_espesores'];
      for (const k of combustibleRequired) {
        if (!(b as any)[k]) {
          return res.status(400).json({ error: `Campo obligatorio para Combustible Líquido: ${k}` });
        }
      }
    }

    const newSemi = await prisma.semirremolque.create({
      data: {
        nombre: b.nombre,
        dominio: b.dominio,
        anio: Number(b.anio),
        estado: b.estado as any,
        tipo_servicio: b.tipo_servicio,
        alcance_servicio: b.alcance_servicio,
        vencimiento_rto: b.vencimiento_rto ? new Date(b.vencimiento_rto) : null,
        vencimiento_visual_externa: b.vencimiento_visual_externa ? new Date(b.vencimiento_visual_externa) : null,
        vencimiento_visual_interna: b.vencimiento_visual_interna ? new Date(b.vencimiento_visual_interna) : null,
        vencimiento_espesores: b.vencimiento_espesores ? new Date(b.vencimiento_espesores) : null,
        vencimiento_prueba_hidraulica: b.vencimiento_prueba_hidraulica ? new Date(b.vencimiento_prueba_hidraulica) : null,
        vencimiento_mangueras: b.vencimiento_mangueras ? new Date(b.vencimiento_mangueras) : null,
        vencimiento_valvula_flujo: b.vencimiento_valvula_flujo ? new Date(b.vencimiento_valvula_flujo) : null
      }
    });

    console.log('[CREAR_SEMI] ✅ Semirremolque creado exitosamente con ID:', newSemi.id);
    res.status(201).json({ id: newSemi.id });
  } catch (e: any) {
    console.error('[CREAR_SEMI] ❌ Error:', e);
    if (e?.code === 'P2002') {
      console.log('[CREAR_SEMI] Error de duplicado en BD');
      return res.status(400).json({ error: 'Ya existe un semirremolque con ese dominio' });
    }
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
    console.log('[ACTUALIZAR_SEMI] Iniciando actualización para ID:', id);
    
    // Validar existencia
    const current = await prisma.semirremolque.findUnique({ where: { id: Number(id) } });
    if (!current) {
      return res.status(404).json({ error: 'Semirremolque no encontrado' });
    }

    // Si se está actualizando el dominio, verificar duplicados
    if (b.dominio && b.dominio !== current.dominio) {
      const existing = await prisma.semirremolque.findUnique({ where: { dominio: b.dominio } });
      if (existing) {
        return res.status(400).json({ error: `Ya existe un semirremolque con el dominio ${b.dominio} (${existing.nombre})` });
      }
    }

    const dataToUpdate: any = {};
    if (b.nombre !== undefined) dataToUpdate.nombre = b.nombre;
    if (b.dominio !== undefined) dataToUpdate.dominio = b.dominio;
    if (b.anio !== undefined) dataToUpdate.anio = b.anio !== null ? Number(b.anio) : null;
    if (b.estado !== undefined) dataToUpdate.estado = b.estado;
    if (b.tipo_servicio !== undefined) dataToUpdate.tipo_servicio = b.tipo_servicio;
    if (b.alcance_servicio !== undefined) dataToUpdate.alcance_servicio = b.alcance_servicio;
    
    if (b.vencimiento_rto !== undefined) dataToUpdate.vencimiento_rto = b.vencimiento_rto ? new Date(b.vencimiento_rto) : null;
    if (b.vencimiento_visual_externa !== undefined) dataToUpdate.vencimiento_visual_externa = b.vencimiento_visual_externa ? new Date(b.vencimiento_visual_externa) : null;
    if (b.vencimiento_visual_interna !== undefined) dataToUpdate.vencimiento_visual_interna = b.vencimiento_visual_interna ? new Date(b.vencimiento_visual_interna) : null;
    if (b.vencimiento_espesores !== undefined) dataToUpdate.vencimiento_espesores = b.vencimiento_espesores ? new Date(b.vencimiento_espesores) : null;
    if (b.vencimiento_prueba_hidraulica !== undefined) dataToUpdate.vencimiento_prueba_hidraulica = b.vencimiento_prueba_hidraulica ? new Date(b.vencimiento_prueba_hidraulica) : null;
    if (b.vencimiento_mangueras !== undefined) dataToUpdate.vencimiento_mangueras = b.vencimiento_mangueras ? new Date(b.vencimiento_mangueras) : null;
    if (b.vencimiento_valvula_flujo !== undefined) dataToUpdate.vencimiento_valvula_flujo = b.vencimiento_valvula_flujo ? new Date(b.vencimiento_valvula_flujo) : null;

    await prisma.semirremolque.update({
      where: { id: Number(id) },
      data: dataToUpdate
    });

    console.log('[ACTUALIZAR_SEMI] ✅ Semirremolque actualizado exitosamente');
    res.json({ ok: true });
  } catch (e: any) {
    console.error('[ACTUALIZAR_SEMI] ❌ Error:', e);
    if (e?.code === 'P2002') {
      return res.status(400).json({ error: 'Ya existe un semirremolque con ese dominio' });
    }
    res.status(500).json({ error: 'Error al actualizar semirremolque' });
  }
}

export async function eliminarSemi(req: Request<{ id: string }>, res: Response) {
  try {
    const { id } = req.params;
    
    const existing = await prisma.semirremolque.findUnique({ where: { id: Number(id) } });
    if (!existing) return res.status(404).json({ error: 'Semirremolque no encontrado' });

    await prisma.semirremolque.delete({
      where: { id: Number(id) }
    });
    
    res.json({ ok: true });
  } catch (e: any) {
    console.error('Error al eliminar semirremolque:', e);
    if (e.code === 'P2003') {
      return res.status(400).json({ 
        error: 'No se puede eliminar el semirremolque porque está asignado a uno o más viajes'
      });
    }
    res.status(500).json({ error: 'Error al eliminar semirremolque' });
  }
}

export async function verificarDominioSemi(req: Request<{ dominio: string }, {}, {}, { excludeId?: string }>, res: Response) {
  try {
    const { dominio } = req.params;
    const { excludeId } = req.query;
    
    // Normalizar dominio: eliminar espacios y convertir a mayúsculas
    const dominioNormalizado = dominio.replace(/\s+/g, '').toUpperCase();
    
    let existing;
    if (excludeId) {
      const results = await prisma.$queryRaw<any[]>`
        SELECT id, nombre, dominio 
        FROM semirremolque 
        WHERE REPLACE(UPPER(dominio), ' ', '') = ${dominioNormalizado} 
        AND id != ${Number(excludeId)} 
        LIMIT 1
      `;
      existing = results[0];
    } else {
      const results = await prisma.$queryRaw<any[]>`
        SELECT id, nombre, dominio 
        FROM semirremolque 
        WHERE REPLACE(UPPER(dominio), ' ', '') = ${dominioNormalizado} 
        LIMIT 1
      `;
      existing = results[0];
    }
    
    if (existing) {
      return res.json({ 
        exists: true, 
        id: existing.id,
        info: existing.nombre
      });
    }
    
    res.json({ exists: false });
  } catch (e) {
    console.error('Error al verificar dominio:', e);
    res.status(500).json({ error: 'Error al verificar dominio' });
  }
}
