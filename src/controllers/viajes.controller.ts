import { Request, Response } from "express";
import { prisma } from "../db/prisma.js";
import type { Viaje, ViajeDestino } from "../types/viaje.js";
import { EstadoViaje, EstadoUnidad, AlcanceViaje } from '@prisma/client';

// Función para obtener la fecha límite actual en GMT-3 a las 00:00:00
const getTodayGMT3 = (): Date => {
  const now = new Date();
  
  // Convertimos la hora actual a string en la zona horaria GMT-3 (Argentina)
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  
  // format returns MM/DD/YYYY
  const parts = formatter.formatToParts(now);
  const year = parts.find(p => p.type === 'year')?.value;
  const month = parts.find(p => p.type === 'month')?.value;
  const day = parts.find(p => p.type === 'day')?.value;

  // Devolvemos el Date representando el inicio del día en GMT-3
  return new Date(`${year}-${month}-${day}T00:00:00.000-03:00`);
};

const mapEstadoViajeIn = (estado: string): EstadoViaje => {
  if (estado === 'en curso') return 'en_curso';
  return estado as EstadoViaje;
};

const mapEstadoViajeOut = (estado: EstadoViaje): string => {
  if (estado === 'en_curso') return 'en curso';
  return estado;
};

const mapEstadoUnidadOut = (estado: EstadoUnidad | null | undefined): string | null => {
  if (!estado) return null;
  if (estado === 'en_reparacion') return 'en reparacion';
  if (estado === 'fuera_de_servicio') return 'fuera de servicio';
  if (estado === 'en_viaje') return 'en viaje';
  return estado;
};

/** GET /api/viajes */
export async function listarViajes(_req: Request, res: Response) {
  try {
    const viajes = await prisma.viaje.findMany({
      include: {
        tractor: true,
        semirremolque: true,
        chofer: true
      },
      orderBy: { id: 'desc' }
    });

    const rows = viajes.map(v => ({
      ...v,
      estado: mapEstadoViajeOut(v.estado),
      tractor_marca: v.tractor?.marca,
      tractor_modelo: v.tractor?.modelo,
      tractor_dominio: v.tractor?.dominio,
      tractor_estado: mapEstadoUnidadOut(v.tractor?.estado),
      semirremolque_nombre: v.semirremolque?.nombre,
      semirremolque_dominio: v.semirremolque?.dominio,
      chofer_nombre: v.chofer?.nombre,
      chofer_apellido: v.chofer?.apellido
    }));

    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error al listar viajes" });
  }
}

/** GET /api/viajes/:id (incluye destinos) */
export async function obtenerViaje(
  req: Request<{ id: string }>,
  res: Response
) {
  try {
    const { id } = req.params;
    const viaje = await prisma.viaje.findUnique({
      where: { id: Number(id) },
      include: {
        destinos: {
          orderBy: { orden: 'asc' }
        }
      }
    });

    if (!viaje) return res.status(404).json({ error: "Viaje no encontrado" });

    res.json({
      ...viaje,
      estado: mapEstadoViajeOut(viaje.estado)
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error al obtener viaje" });
  }
}

export async function obtenerViajesPorChofer(
  req: Request<{ chofer_id: string }>,
  res: Response
) {
  try {
    const { chofer_id } = req.params;
    const viajes = await prisma.viaje.findMany({
      where: { chofer_id: Number(chofer_id) },
      include: { tractor: true },
      orderBy: { fecha_hora_salida: 'desc' }
    });

    const rows = viajes.map(v => ({
      ...v,
      estado: mapEstadoViajeOut(v.estado),
      tractor_marca: v.tractor?.marca,
      tractor_modelo: v.tractor?.modelo,
      tractor_dominio: v.tractor?.dominio,
      tractor_estado: mapEstadoUnidadOut(v.tractor?.estado)
    }));

    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error al obtener viajes por chofer" });
  }
}

/** POST /api/viajes  (Body: Viaje + destinos: ViajeDestino[]) */
export async function crearViaje(
  req: Request<{}, {}, Viaje & { destinos?: Array<Omit<ViajeDestino, "id">> }>,
  res: Response
) {
  const body = req.body;
  
  // validación mínima
  const required: Array<keyof Viaje> = [
    "chofer_id",
    "tractor_id",
    "semirremolque_id",
    "servicio_id",
    "alcance",
    "origen",
    "fecha_hora_salida",
    "estado",
  ];
  for (const k of required) {
    if (
      (body as any)[k] === undefined ||
      (body as any)[k] === null ||
      (body as any)[k] === ""
    ) {
      return res.status(400).json({ error: `Campo obligatorio faltante: ${k}` });
    }
  }
  if (!["nacional", "internacional"].includes(body.alcance)) {
    return res.status(400).json({ error: "alcance inválido" });
  }
  if (!["programado", "en curso", "finalizado"].includes(body.estado)) {
    return res.status(400).json({ error: "estado inválido" });
  }

  const destinos = body.destinos ?? [];
  for (const d of destinos) {
    if (typeof d.orden !== "number" || !d.ubicacion) {
      return res.status(400).json({ error: "Destino inválido: requiere orden (number) y ubicacion (string)" });
    }
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Validar foreign keys existen y obtener datos completos para validar vencimientos
      const chofer = await tx.chofer.findUnique({ where: { id: Number(body.chofer_id) } });
      const tractor = await tx.tractor.findUnique({ where: { id: Number(body.tractor_id) } });
      const semirremolque = await tx.semirremolque.findUnique({ where: { id: Number(body.semirremolque_id) } });
      const servicio = await tx.servicio.findUnique({ where: { id: Number(body.servicio_id) } });

      if (!chofer || !tractor || !semirremolque || !servicio) {
        throw new Error("Alguna referencia (chofer/tractor/semi/servicio) no existe");
      }

      // Validar chofer
      if (!chofer.activo) {
        throw new Error('El chofer no está activo');
      }
      if (chofer.fecha_vencimiento_licencia) {
        // Obtenemos la fecha de vencimiento. Prisma la trae al parsear la DB.
        // Aseguramos que la comparación sea contra el inicio de hoy en Argentina
        const vencimiento = new Date(chofer.fecha_vencimiento_licencia);
        const hoyGMT3 = getTodayGMT3();
        if (vencimiento < hoyGMT3) {
          throw new Error('El chofer tiene la licencia vencida');
        }
      }

      // Validar tractor
      const estadosNoPermitidos: EstadoUnidad[] = ['en_reparacion', 'fuera_de_servicio'];
      if (estadosNoPermitidos.includes(tractor.estado)) {
        const estadoMensajes: Record<string, string> = {
          'en_reparacion': 'El tractor está en reparación',
          'fuera_de_servicio': 'El tractor está fuera de servicio'
        };
        throw new Error(estadoMensajes[tractor.estado] || 'El tractor no está disponible');
      }
      if (tractor.vencimiento_rto) {
        const vencimiento = new Date(tractor.vencimiento_rto);
        const hoyGMT3 = getTodayGMT3();
        if (vencimiento < hoyGMT3) {
          throw new Error('El tractor tiene el RTO vencido');
        }
      }

      // Validar semirremolque
      if (estadosNoPermitidos.includes(semirremolque.estado)) {
        const estadoMensajes: Record<string, string> = {
          'en_reparacion': 'El semirremolque está en reparación',
          'fuera_de_servicio': 'El semirremolque está fuera de servicio'
        };
        throw new Error(estadoMensajes[semirremolque.estado] || 'El semirremolque no está disponible');
      }
      
      // Validar vencimientos del semirremolque según tipo de servicio
      if (semirremolque.tipo_servicio) {
        const camposRequeridos: Record<string, (keyof typeof semirremolque)[]> = {
          'gas líquido': ['vencimiento_mangueras', 'vencimiento_prueba_hidraulica', 'vencimiento_valvula_flujo'],
          'gas licuado': ['vencimiento_mangueras', 'vencimiento_prueba_hidraulica', 'vencimiento_valvula_flujo'],
          'combustible líquido': ['vencimiento_rto', 'vencimiento_visual_externa', 'vencimiento_visual_interna', 'vencimiento_espesores']
        };
        
        const campos = camposRequeridos[semirremolque.tipo_servicio.toLowerCase()] || [];
        const etiquetas: Record<string, string> = {
          'vencimiento_rto': 'RTO',
          'vencimiento_visual_externa': 'Visual Externa',
          'vencimiento_visual_interna': 'Visual Interna',
          'vencimiento_espesores': 'Espesores',
          'vencimiento_prueba_hidraulica': 'Prueba Hidráulica',
          'vencimiento_mangueras': 'Mangueras',
          'vencimiento_valvula_flujo': 'Válvula de Flujo'
        };
        
        for (const campo of campos) {
          const valor = semirremolque[campo];
          if (valor) {
            const vencimiento = new Date(valor as any);
            const hoyGMT3 = getTodayGMT3();
            if (vencimiento < hoyGMT3) {
              throw new Error(`El semirremolque tiene ${etiquetas[campo] || campo} vencido`);
            }
          }
        }
      }

      const estadoMapped = mapEstadoViajeIn(body.estado);

      const viajeCreado = await tx.viaje.create({
        data: {
          chofer_id: Number(body.chofer_id),
          tractor_id: Number(body.tractor_id),
          semirremolque_id: Number(body.semirremolque_id),
          servicio_id: Number(body.servicio_id),
          alcance: body.alcance as AlcanceViaje,
          origen: body.origen,
          cantidad_destinos: destinos.length,
          fecha_hora_salida: new Date(body.fecha_hora_salida),
          estado: estadoMapped,
          destinos: {
            create: destinos.map(d => ({
              orden: d.orden,
              ubicacion: d.ubicacion
            }))
          }
        }
      });

      // Si el viaje se crea en estado 'en curso', actualizar estados de unidades y chofer
      if (estadoMapped === 'en_curso') {
        await tx.chofer.update({
          where: { id: Number(body.chofer_id) },
          data: { estado: 'en_viaje' }
        });
        await tx.tractor.update({
          where: { id: Number(body.tractor_id) },
          data: { estado: 'en_viaje' }
        });
        await tx.semirremolque.update({
          where: { id: Number(body.semirremolque_id) },
          data: { estado: 'en_viaje' }
        });
      }

      return viajeCreado.id;
    });

    res.status(201).json({ id: result });
  } catch (e: any) {
    const msg = e?.message || "Error al crear viaje";
    console.error(e);
    res.status(400).json({ error: msg });
  }
}

/** PUT /api/viajes/:id  (puede reemplazar destinos completos si envías destinos[]) */
export async function actualizarViaje(
  req: Request<
    { id: string },
    {},
    Partial<Viaje> & { destinos?: Array<Omit<ViajeDestino, "id">> }
  >,
  res: Response
) {
  const idViaje = Number(req.params.id);
  const b = req.body;

  try {
    await prisma.$transaction(async (tx) => {
      // Obtener el estado actual del viaje y las unidades asignadas
      const viajeActual = await tx.viaje.findUnique({
        where: { id: idViaje },
        select: { estado: true, chofer_id: true, tractor_id: true, semirremolque_id: true }
      });

      if (!viajeActual) {
        throw new Error("Viaje no encontrado_404");
      }

      const estadoAnterior = viajeActual.estado;
      const estadoNuevoString = b.estado ? mapEstadoViajeIn(b.estado) : estadoAnterior;

      const updateData: any = {};
      if (b.chofer_id !== undefined) updateData.chofer_id = Number(b.chofer_id);
      if (b.tractor_id !== undefined) updateData.tractor_id = Number(b.tractor_id);
      if (b.semirremolque_id !== undefined) updateData.semirremolque_id = Number(b.semirremolque_id);
      if (b.servicio_id !== undefined) updateData.servicio_id = Number(b.servicio_id);
      if (b.alcance !== undefined) updateData.alcance = b.alcance;
      if (b.origen !== undefined) updateData.origen = b.origen;
      if (b.fecha_hora_salida !== undefined) updateData.fecha_hora_salida = b.fecha_hora_salida ? new Date(b.fecha_hora_salida) : null;
      if (b.estado !== undefined) updateData.estado = estadoNuevoString;

      // Handle destinations overwrite if provided
      if (b.destinos) {
        for (const d of b.destinos) {
          if (typeof d.orden !== "number" || !d.ubicacion) {
            throw new Error("Destino inválido: requiere orden (number) y ubicacion (string)_400");
          }
        }
        
        updateData.cantidad_destinos = b.destinos.length;
        
        // delete old and create new
        await tx.destino.deleteMany({ where: { viaje_id: idViaje } });
        updateData.destinos = {
          create: b.destinos.map(d => ({
            orden: d.orden,
            ubicacion: d.ubicacion
          }))
        };
      }

      await tx.viaje.update({
        where: { id: idViaje },
        data: updateData
      });

      // Actualizar estados de unidades según cambio de estado del viaje
      const choferId = b.chofer_id !== undefined ? Number(b.chofer_id) : viajeActual.chofer_id;
      const tractorId = b.tractor_id !== undefined ? Number(b.tractor_id) : viajeActual.tractor_id;
      const semirremolqueId = b.semirremolque_id !== undefined ? Number(b.semirremolque_id) : viajeActual.semirremolque_id;

      // Si el viaje pasa de 'programado' a 'en curso'
      if (estadoAnterior === 'programado' && estadoNuevoString === 'en_curso') {
        if (choferId) await tx.chofer.update({ where: { id: choferId }, data: { estado: 'en_viaje' } });
        if (tractorId) await tx.tractor.update({ where: { id: tractorId }, data: { estado: 'en_viaje' } });
        if (semirremolqueId) await tx.semirremolque.update({ where: { id: semirremolqueId }, data: { estado: 'en_viaje' } });
      }

      // Si el viaje pasa a 'finalizado'
      if (estadoNuevoString === 'finalizado' && estadoAnterior !== 'finalizado') {
        if (choferId) await tx.chofer.update({ where: { id: choferId }, data: { estado: 'disponible' } });
        if (tractorId) await tx.tractor.update({ where: { id: tractorId }, data: { estado: 'disponible' } });
        if (semirremolqueId) await tx.semirremolque.update({ where: { id: semirremolqueId }, data: { estado: 'disponible' } });
      }
    });

    res.json({ ok: true });
  } catch (e: any) {
    console.error(e);
    if (e.message.includes("_404")) return res.status(404).json({ error: "Viaje no encontrado" });
    if (e.message.includes("_400")) return res.status(400).json({ error: e.message.replace("_400", "") });
    res.status(500).json({ error: "Error al actualizar viaje" });
  }
}

/** DELETE /api/viajes/:id  (borra destinos por ON DELETE CASCADE) */
export async function eliminarViaje(
  req: Request<{ id: string }>,
  res: Response
) {
  const idViaje = Number(req.params.id);
  
  try {
    await prisma.$transaction(async (tx) => {
      // Obtener las unidades asignadas antes de eliminar el viaje
      const viaje = await tx.viaje.findUnique({
        where: { id: idViaje },
        select: { chofer_id: true, tractor_id: true, semirremolque_id: true, estado: true }
      });
      
      if (!viaje) {
        throw new Error("Viaje no encontrado_404");
      }
      
      // Eliminar el viaje
      await tx.viaje.delete({ where: { id: idViaje } });
      
      // Cambiar estado de las unidades a 'disponible' solo si el viaje no estaba finalizado
      if (viaje.estado !== 'finalizado') {
        if (viaje.chofer_id) {
          await tx.chofer.update({ where: { id: viaje.chofer_id }, data: { estado: 'disponible' } });
        }
        if (viaje.tractor_id) {
          await tx.tractor.update({ where: { id: viaje.tractor_id }, data: { estado: 'disponible' } });
        }
        if (viaje.semirremolque_id) {
          await tx.semirremolque.update({ where: { id: viaje.semirremolque_id }, data: { estado: 'disponible' } });
        }
      }
    });
    
    res.json({ ok: true });
  } catch (e: any) {
    console.error(e);
    if (e.message.includes("_404")) return res.status(404).json({ error: "Viaje no encontrado" });
    res.status(500).json({ error: "Error al eliminar viaje" });
  }
}
