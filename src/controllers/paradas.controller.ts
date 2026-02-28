import { Request, Response } from "express";
import { prisma } from "../db/prisma.js";
import type { Parada, CreateParadaDTO } from "../types/parada.js";
import { TipoParada, EstadoViaje, EstadoUnidad } from "@prisma/client";

/** GET /api/paradas/viaje/:viaje_id - Obtener todas las paradas de un viaje */
export async function listarParadasPorViaje(
  req: Request<{ viaje_id: string }>,
  res: Response
) {
  try {
    const { viaje_id } = req.params;
    const paradas = await prisma.parada.findMany({
      where: { viaje_id: Number(viaje_id) },
      orderBy: { fecha_hora: 'asc' }
    });
    
    // Map to ensure Decimal is converted to number if needed for response
    const rows = paradas.map(p => ({
      ...p,
      odometro: Number(p.odometro)
    }));

    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error al listar paradas" });
  }
}

/** POST /api/paradas - Crear una nueva parada */
export async function crearParada(
  req: Request<{}, {}, CreateParadaDTO>,
  res: Response
) {
  const body = req.body;

  // Validación básica
  if (!body.viaje_id || body.odometro === undefined || !body.ubicacion || !body.tipo) {
    return res.status(400).json({
      error: "Campos obligatorios: viaje_id, odometro, ubicacion, tipo",
    });
  }

  // Validar tipo de parada
  const tiposValidos = ['inicio', 'descanso', 'carga', 'otro', 'llegada'];
  if (!tiposValidos.includes(body.tipo)) {
    return res.status(400).json({ error: "Tipo de parada inválido" });
  }

  // Si es tipo llegada, debe tener destino_id
  if (body.tipo === 'llegada' && !body.destino_id) {
    return res.status(400).json({
      error: "Las paradas de tipo 'llegada' requieren destino_id",
    });
  }

  try {
    const paradaCreada = await prisma.$transaction(async (tx) => {
      // Verificar que el viaje existe
      const viaje = await tx.viaje.findUnique({
        where: { id: body.viaje_id },
        select: { id: true, estado: true, tractor_id: true, semirremolque_id: true, chofer_id: true }
      });

      if (!viaje) {
        throw new Error("Viaje no encontrado");
      }

      // Si es tipo inicio, cambiar estado del viaje a 'en_curso'
      if (body.tipo === 'inicio') {
        // Verificar que no haya otra parada de inicio
        const paradaInicio = await tx.parada.findFirst({
          where: { viaje_id: body.viaje_id, tipo: 'inicio' }
        });

        if (paradaInicio) {
          throw new Error("Ya existe una parada de inicio para este viaje");
        }

        // Cambiar estado del viaje a 'en_curso'
        await tx.viaje.update({
          where: { id: body.viaje_id },
          data: { estado: 'en_curso' }
        });

        // Cambiar estado del tractor, semirremolque y chofer a 'en_viaje'
        if (viaje.tractor_id) {
          await tx.tractor.update({
             where: { id: viaje.tractor_id },
             data: { estado: 'en_viaje' }
          });
        }
        if (viaje.semirremolque_id) {
          await tx.semirremolque.update({
             where: { id: viaje.semirremolque_id },
             data: { estado: 'en_viaje' }
          });
        }
        if (viaje.chofer_id) {
          await tx.chofer.update({
             where: { id: viaje.chofer_id },
             data: { estado: 'en_viaje' }
          });
        }
      }

      // Verificar que el odómetro no sea menor que paradas previas
      const maxOdometroAgg = await tx.parada.aggregate({
        _max: { odometro: true },
        where: { viaje_id: body.viaje_id }
      });

      const maxOdometro = maxOdometroAgg._max.odometro;
      if (maxOdometro && Number(body.odometro) < Number(maxOdometro)) {
        throw new Error(`El odómetro (${body.odometro} km) no puede ser menor que el odómetro previo (${maxOdometro} km)`);
      }

      // Si es tipo llegada, verificar que el destino existe
      if (body.tipo === 'llegada' && body.destino_id) {
        const destino = await tx.destino.findFirst({
          where: { id: body.destino_id, viaje_id: body.viaje_id }
        });

        if (!destino) {
          throw new Error("Destino no encontrado o no pertenece a este viaje");
        }
      }

      // Insertar la parada
      const result = await tx.parada.create({
        data: {
          viaje_id: body.viaje_id,
          odometro: body.odometro,
          ubicacion: body.ubicacion,
          tipo: body.tipo as TipoParada,
          destino_id: body.destino_id || null,
        }
      });

      return result;
    });

    res.status(201).json({ id: paradaCreada.id });
  } catch (e: any) {
    console.error(e);
    const msg = e?.message || "Error al crear parada";
    // Avoid sending Prisma internal errors if they leak DB info
    res.status(msg.includes(" no encontrado") || msg.includes("menor que el odómetro prev") || msg.includes("Ya existe") ? 400 : 500).json({ error: msg });
  }
}

/** PUT /api/viajes/:viaje_id/finalizar - Finalizar un viaje */
export async function finalizarViaje(
  req: Request<{ viaje_id: string }>,
  res: Response
) {
  const viaje_id = Number(req.params.viaje_id);

  try {
    await prisma.$transaction(async (tx) => {
      // Obtener el viaje con todos los datos necesarios
      const viaje = await tx.viaje.findUnique({
        where: { id: viaje_id },
        select: { id: true, cantidad_destinos: true, estado: true, tractor_id: true, semirremolque_id: true, chofer_id: true }
      });

      if (!viaje) {
        throw new Error("Viaje no encontrado");
      }

      if (viaje.estado === 'finalizado') {
        throw new Error("El viaje ya está finalizado");
      }

      // Contar paradas de tipo llegada
      const countLlegadas = await tx.parada.count({
        where: { viaje_id, tipo: 'llegada' }
      });

      if (countLlegadas < viaje.cantidad_destinos) {
        throw new Error(`Faltan paradas de llegada. Se requieren ${viaje.cantidad_destinos}, solo hay ${countLlegadas}`);
      }

      // Actualizar estado del viaje a finalizado
      await tx.viaje.update({
        where: { id: viaje_id },
        data: { estado: 'finalizado' }
      });

      // Cambiar estado del tractor, semirremolque y chofer a 'disponible'
      if (viaje.tractor_id) {
        await tx.tractor.update({
          where: { id: viaje.tractor_id },
          data: { estado: 'disponible' }
        });
      }
      if (viaje.semirremolque_id) {
        await tx.semirremolque.update({
          where: { id: viaje.semirremolque_id },
          data: { estado: 'disponible' }
        });
      }
      if (viaje.chofer_id) {
        await tx.chofer.update({
          where: { id: viaje.chofer_id },
          data: { estado: 'disponible' }
        });
      }
    });

    res.json({ ok: true, message: "Viaje finalizado exitosamente" });
  } catch (e: any) {
    console.error(e);
    const msg = e?.message || "Error al finalizar viaje";
    res.status(msg.includes(" no encontrado") || msg.includes("finalizado") || msg.includes("Faltan paradas") ? 400 : 500).json({ error: msg });
  }
}

/** GET /api/paradas/viaje/:viaje_id/export - Exportar información de paradas */
export async function exportarParadas(
  req: Request<{ viaje_id: string }>,
  res: Response
) {
  try {
    const viaje_id = Number(req.params.viaje_id);

    // Obtener información del viaje
    const viaje = await prisma.viaje.findUnique({
      where: { id: viaje_id },
      include: {
        chofer: { select: { nombre: true, apellido: true } },
        tractor: { select: { marca: true, modelo: true, dominio: true } },
        semirremolque: { select: { nombre: true, dominio: true } },
        servicio: { select: { nombre: true } }
      }
    });

    if (!viaje) {
      return res.status(404).json({ error: "Viaje no encontrado" });
    }

    // Obtener paradas
    const paradas = await prisma.parada.findMany({
      where: { viaje_id },
      include: {
        destino: { select: { ubicacion: true } }
      },
      orderBy: { fecha_hora: 'asc' }
    });

    // Obtener destinos
    const destinos = await prisma.destino.findMany({
      where: { viaje_id },
      orderBy: { orden: 'asc' }
    });

    // Formatear salida similar al SQL original
    const viajeFormatted = {
      ...viaje,
      chofer_nombre: viaje.chofer.nombre,
      chofer_apellido: viaje.chofer.apellido,
      tractor_marca: viaje.tractor.marca,
      tractor_modelo: viaje.tractor.modelo,
      tractor_dominio: viaje.tractor.dominio,
      semirremolque_nombre: viaje.semirremolque.nombre,
      semirremolque_dominio: viaje.semirremolque.dominio,
      servicio_nombre: viaje.servicio.nombre
    };

    const paradasFormatted = paradas.map(p => ({
      ...p,
      odometro: Number(p.odometro),
      destino_ubicacion: p.destino?.ubicacion || null
    }));

    res.json({
      viaje: [viajeFormatted], // Wrapped in array to match old behavior if needed
      paradas: paradasFormatted,
      destinos,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error al exportar paradas" });
  }
}
