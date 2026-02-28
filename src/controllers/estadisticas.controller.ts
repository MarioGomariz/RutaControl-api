import { Request, Response } from "express";
import { prisma } from "../db/prisma.js";
import { Prisma } from "@prisma/client";
import type { FiltrosEstadisticas, RespuestaEstadisticas } from "../types/estadisticas.js";

/** GET /api/estadisticas */
export async function obtenerEstadisticas(
  req: Request<{}, {}, {}, FiltrosEstadisticas>,
  res: Response
) {
  try {
    const { chofer_id, tractor_id, semirremolque_id, servicio_id, fecha_inicio, fecha_fin, alcance } = req.query;

    // Construir condiciones WHERE dinámicamente usando Prisma.sql
    const conditions: Prisma.Sql[] = [];

    if (chofer_id) conditions.push(Prisma.sql`v.chofer_id = ${Number(chofer_id)}`);
    if (tractor_id) conditions.push(Prisma.sql`v.tractor_id = ${Number(tractor_id)}`);
    if (semirremolque_id) conditions.push(Prisma.sql`v.semirremolque_id = ${Number(semirremolque_id)}`);
    if (servicio_id) conditions.push(Prisma.sql`v.servicio_id = ${Number(servicio_id)}`);
    if (fecha_inicio) conditions.push(Prisma.sql`v.fecha_hora_salida >= ${new Date(fecha_inicio)}`);
    if (fecha_fin) conditions.push(Prisma.sql`v.fecha_hora_salida <= ${new Date(fecha_fin)}`);
    if (alcance) conditions.push(Prisma.sql`v.alcance = CAST(${alcance} AS "AlcanceViaje")`);

    const whereClause = conditions.length > 0 
      ? Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}` 
      : Prisma.empty;

    // 1. Estadísticas Generales
    const generalesRows = await prisma.$queryRaw<any[]>`
      SELECT 
        COUNT(*) as total_viajes,
        SUM(CASE WHEN estado = 'programado' THEN 1 ELSE 0 END) as viajes_programados,
        SUM(CASE WHEN estado = 'en curso' THEN 1 ELSE 0 END) as viajes_en_curso,
        SUM(CASE WHEN estado = 'finalizado' THEN 1 ELSE 0 END) as viajes_finalizados
      FROM viaje v
      ${whereClause}
    `;

    // Calcular km totales desde paradas
    const kmRows = await prisma.$queryRaw<any[]>`
      SELECT 
        COALESCE(SUM(
          (SELECT MAX(odometro) - MIN(odometro) 
           FROM paradas 
           WHERE viaje_id = v.id)
        ), 0) as total_km
      FROM viaje v
      ${whereClause}
    `;

    // Contar choferes activos
    const choferesRows = await prisma.$queryRaw<any[]>`
      SELECT COUNT(*) as total FROM chofer WHERE activo = true
    `;

    // Contar tractores disponibles
    const tractoresRows = await prisma.$queryRaw<any[]>`
      SELECT COUNT(*) as total FROM tractores WHERE estado = 'disponible'
    `;

    const generales = {
      total_viajes: Number(generalesRows[0]?.total_viajes || 0),
      viajes_programados: Number(generalesRows[0]?.viajes_programados || 0),
      viajes_en_curso: Number(generalesRows[0]?.viajes_en_curso || 0),
      viajes_finalizados: Number(generalesRows[0]?.viajes_finalizados || 0),
      total_km_recorridos: parseFloat(kmRows[0]?.total_km || 0),
      promedio_km_por_viaje: Number(generalesRows[0]?.total_viajes || 0) > 0 
        ? (parseFloat(kmRows[0]?.total_km || 0) / Number(generalesRows[0]?.total_viajes || 1)) 
        : 0,
      total_choferes_activos: Number(choferesRows[0]?.total || 0),
      total_tractores_disponibles: Number(tractoresRows[0]?.total || 0),
    };

    // 2. Kilómetros por Unidad (Tractor)
    const kilometrosPorUnidad = await prisma.$queryRaw<any[]>`
      SELECT 
        t.id as tractor_id,
        t.marca as tractor_marca,
        t.modelo as tractor_modelo,
        t.dominio as tractor_dominio,
        COUNT(v.id) as cantidad_viajes,
        COALESCE(SUM(
          (SELECT MAX(odometro) - MIN(odometro) 
           FROM paradas 
           WHERE viaje_id = v.id)
        ), 0) as total_km
      FROM tractores t
      LEFT JOIN viaje v ON t.id = v.tractor_id 
        ${conditions.length > 0 ? Prisma.sql`AND ${Prisma.join(conditions, ' AND ')}` : Prisma.empty}
      GROUP BY t.id, t.marca, t.modelo, t.dominio
      ORDER BY total_km DESC
    `;

    // 3. Viajes por Chofer
    const viajesPorChofer = await prisma.$queryRaw<any[]>`
      SELECT 
        c.id as chofer_id,
        c.nombre as chofer_nombre,
        c.apellido as chofer_apellido,
        c.activo as chofer_activo,
        COUNT(v.id) as total_viajes,
        SUM(CASE WHEN v.estado = 'programado' THEN 1 ELSE 0 END) as viajes_programados,
        SUM(CASE WHEN v.estado = 'en curso' THEN 1 ELSE 0 END) as viajes_en_curso,
        SUM(CASE WHEN v.estado = 'finalizado' THEN 1 ELSE 0 END) as viajes_finalizados,
        COALESCE(SUM(
          (SELECT MAX(odometro) - MIN(odometro) 
           FROM paradas 
           WHERE viaje_id = v.id)
        ), 0) as total_km
      FROM chofer c
      LEFT JOIN viaje v ON c.id = v.chofer_id 
        ${conditions.length > 0 ? Prisma.sql`AND ${Prisma.join(conditions, ' AND ')}` : Prisma.empty}
      GROUP BY c.id, c.nombre, c.apellido, c.activo
      ORDER BY total_viajes DESC, c.apellido ASC
    `;

    // 4. Inactividad de Vehículos
    const inactividadVehiculos = await prisma.$queryRaw<any[]>`
      SELECT 
        t.id as tractor_id,
        t.marca as tractor_marca,
        t.modelo as tractor_modelo,
        t.dominio as tractor_dominio,
        t.estado,
        MAX(v.fecha_hora_salida) as ultimo_viaje,
        CASE 
          WHEN MAX(v.fecha_hora_salida) IS NULL THEN 999
          WHEN MAX(v.fecha_hora_salida) > NOW() THEN 0
          ELSE EXTRACT(DAY FROM (NOW() - MAX(v.fecha_hora_salida)))
        END as dias_inactivo
      FROM tractores t
      LEFT JOIN viaje v ON t.id = v.tractor_id AND (v.estado = 'en curso' OR v.estado = 'finalizado')
      GROUP BY t.id, t.marca, t.modelo, t.dominio, t.estado
      ORDER BY dias_inactivo DESC
    `;

    // 5. Viajes por Mes
    const viajesPorMes = await prisma.$queryRaw<any[]>`
      SELECT 
        TO_CHAR(v.fecha_hora_salida, 'YYYY-MM') as mes,
        EXTRACT(YEAR FROM v.fecha_hora_salida) as anio,
        COUNT(*) as total_viajes,
        SUM(CASE WHEN v.estado = 'finalizado' THEN 1 ELSE 0 END) as viajes_finalizados,
        COALESCE(SUM(
          (SELECT MAX(odometro) - MIN(odometro) 
           FROM paradas 
           WHERE viaje_id = v.id)
        ), 0) as total_km
      FROM viaje v
      ${whereClause}
      GROUP BY TO_CHAR(v.fecha_hora_salida, 'YYYY-MM'), EXTRACT(YEAR FROM v.fecha_hora_salida)
      ORDER BY mes DESC
      LIMIT 12
    `;

    // 6. Viajes por Servicio
    const viajesPorServicio = await prisma.$queryRaw<any[]>`
      SELECT 
        s.id as servicio_id,
        s.nombre as servicio_nombre,
        COUNT(v.id) as total_viajes,
        SUM(CASE WHEN v.estado = 'programado' THEN 1 ELSE 0 END) as viajes_programados,
        SUM(CASE WHEN v.estado = 'en curso' THEN 1 ELSE 0 END) as viajes_en_curso,
        SUM(CASE WHEN v.estado = 'finalizado' THEN 1 ELSE 0 END) as viajes_finalizados
      FROM servicios s
      LEFT JOIN viaje v ON s.id = v.servicio_id 
        ${conditions.length > 0 ? Prisma.sql`AND ${Prisma.join(conditions, ' AND ')}` : Prisma.empty}
      GROUP BY s.id, s.nombre
      ORDER BY total_viajes DESC
    `;

    const respuesta: RespuestaEstadisticas = {
      generales,
      kilometros_por_unidad: kilometrosPorUnidad.map((row: any) => ({
        tractor_id: row.tractor_id,
        tractor_marca: row.tractor_marca,
        tractor_modelo: row.tractor_modelo,
        tractor_dominio: row.tractor_dominio,
        total_km: parseFloat(row.total_km) || 0,
        cantidad_viajes: Number(row.cantidad_viajes) || 0,
      })),
      viajes_por_chofer: viajesPorChofer.map((row: any) => ({
        chofer_id: row.chofer_id,
        chofer_nombre: row.chofer_nombre,
        chofer_apellido: row.chofer_apellido,
        chofer_activo: row.chofer_activo,
        total_viajes: Number(row.total_viajes) || 0,
        viajes_programados: Number(row.viajes_programados) || 0,
        viajes_en_curso: Number(row.viajes_en_curso) || 0,
        viajes_finalizados: Number(row.viajes_finalizados) || 0,
        total_km: parseFloat(row.total_km) || 0,
      })),
      inactividad_vehiculos: inactividadVehiculos.map((row: any) => ({
        tractor_id: row.tractor_id,
        tractor_marca: row.tractor_marca,
        tractor_modelo: row.tractor_modelo,
        tractor_dominio: row.tractor_dominio,
        ultimo_viaje: row.ultimo_viaje,
        dias_inactivo: Number(row.dias_inactivo) || 0,
        estado: row.estado,
      })),
      viajes_por_mes: viajesPorMes.map((row: any) => ({
        mes: row.mes,
        anio: Number(row.anio),
        total_viajes: Number(row.total_viajes) || 0,
        viajes_finalizados: Number(row.viajes_finalizados) || 0,
        total_km: parseFloat(row.total_km) || 0,
      })),
      viajes_por_servicio: viajesPorServicio.map((row: any) => ({
        servicio_id: row.servicio_id,
        servicio_nombre: row.servicio_nombre,
        total_viajes: Number(row.total_viajes) || 0,
        viajes_programados: Number(row.viajes_programados) || 0,
        viajes_en_curso: Number(row.viajes_en_curso) || 0,
        viajes_finalizados: Number(row.viajes_finalizados) || 0,
      })),
    };

    res.json(respuesta);
  } catch (error) {
    console.error("Error al obtener estadísticas:", error);
    res.status(500).json({ error: "Error al obtener estadísticas: " + (error as any).message });
  }
}

/** GET /api/estadisticas/chofer/:chofer_id/viajes-detallados */
export async function obtenerViajesDetalladosPorChofer(
  req: Request<{ chofer_id: string }, {}, {}, FiltrosEstadisticas>,
  res: Response
) {
  try {
    const { chofer_id } = req.params;
    const { fecha_inicio, fecha_fin } = req.query;

    const conditions: Prisma.Sql[] = [Prisma.sql`v.chofer_id = ${Number(chofer_id)}`];

    if (fecha_inicio) {
      conditions.push(Prisma.sql`v.fecha_hora_salida >= ${new Date(fecha_inicio)}`);
    }
    if (fecha_fin) {
      conditions.push(Prisma.sql`v.fecha_hora_salida <= ${new Date(fecha_fin)}`);
    }

    const whereClause = Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}`;

    // Obtener viajes con información de paradas y tractor
    const viajes = await prisma.$queryRaw<any[]>`
      SELECT 
        v.id as viaje_id,
        v.fecha_hora_salida,
        v.origen,
        v.estado,
        t.marca as tractor_marca,
        t.modelo as tractor_modelo,
        t.dominio as tractor_dominio,
        (SELECT MIN(odometro) FROM paradas WHERE viaje_id = v.id) as odometro_inicio,
        (SELECT MAX(odometro) FROM paradas WHERE viaje_id = v.id) as odometro_fin,
        (SELECT MAX(odometro) - MIN(odometro) FROM paradas WHERE viaje_id = v.id) as km_totales
      FROM viaje v
      LEFT JOIN tractores t ON v.tractor_id = t.id
      ${whereClause}
      ORDER BY v.fecha_hora_salida DESC
    `;

    // Para cada viaje, generar tramos (origen -> destino1, destino1 -> destino2, etc)
    const tramosDetallados: any[] = [];
    
    for (const viaje of viajes) {
      const destinos = await prisma.$queryRaw<any[]>`
        SELECT ubicacion, orden
        FROM destinos
        WHERE viaje_id = ${viaje.viaje_id}
        ORDER BY orden ASC
      `;

      const paradas = await prisma.$queryRaw<any[]>`
        SELECT 
          odometro,
          fecha_hora,
          tipo,
          destino_id
        FROM paradas
        WHERE viaje_id = ${viaje.viaje_id}
        ORDER BY fecha_hora ASC
      `;

      // Si no hay destinos, crear un solo tramo con origen y sin destino
      if (destinos.length === 0) {
        const paradaInicio = paradas.find((p: any) => p.tipo === 'inicio');
        const ultimaParada = paradas[paradas.length - 1];
        
        let km_comunes = 0;
        let km_100x100 = 0;

        for (let i = 0; i < paradas.length - 1; i++) {
          const paradaActual = paradas[i];
          const paradaSiguiente = paradas[i + 1];
          
          const fecha = new Date(paradaActual.fecha_hora);
          const diaSemana = fecha.getDay();
          const hora = fecha.getHours();
          const minutos = fecha.getMinutes();
          const totalMinutos = hora * 60 + minutos;

          const kmSegmento = parseFloat(paradaSiguiente.odometro) - parseFloat(paradaActual.odometro);

          if ((diaSemana === 6 && totalMinutos > 780) || diaSemana === 0) {
            km_100x100 += kmSegmento;
          } else {
            km_comunes += kmSegmento;
          }
        }

        tramosDetallados.push({
          viaje_id: viaje.viaje_id,
          fecha_salida: paradaInicio?.fecha_hora || viaje.fecha_hora_salida,
          origen: viaje.origen,
          fecha_llegada: ultimaParada?.fecha_hora || null,
          destino: null,
          km_comunes: km_comunes,
          km_100x100: km_100x100,
          tractor_marca: viaje.tractor_marca,
          tractor_modelo: viaje.tractor_modelo,
          tractor_dominio: viaje.tractor_dominio
        });
      } else {
        // Crear tramos: origen -> destino1, destino1 -> destino2, etc
        const puntos = [viaje.origen, ...destinos.map((d: any) => d.ubicacion)];
        
        for (let i = 0; i < puntos.length - 1; i++) {
          const origenTramo = puntos[i];
          const destinoTramo = puntos[i + 1];
          
          // Encontrar las paradas correspondientes a este tramo
          let paradaInicio: any;
          let paradaFin: any;
          
          if (i === 0) {
            // Primer tramo: desde inicio hasta primera llegada
            paradaInicio = paradas.find((p: any) => p.tipo === 'inicio');
            paradaFin = paradas.find((p: any) => p.tipo === 'llegada');
          } else {
            // Tramos siguientes: desde llegada anterior hasta siguiente llegada
            const paradasLlegada = paradas.filter((p: any) => p.tipo === 'llegada');
            paradaInicio = paradasLlegada[i - 1];
            paradaFin = paradasLlegada[i];
          }

          // Calcular km del tramo
          let km_comunes = 0;
          let km_100x100 = 0;

          if (paradaInicio && paradaFin) {
            const indexInicio = paradas.findIndex((p: any) => p === paradaInicio);
            const indexFin = paradas.findIndex((p: any) => p === paradaFin);

            for (let j = indexInicio; j < indexFin; j++) {
              const paradaActual = paradas[j];
              const paradaSiguiente = paradas[j + 1];
              
              const fecha = new Date(paradaActual.fecha_hora);
              const diaSemana = fecha.getDay();
              const hora = fecha.getHours();
              const minutos = fecha.getMinutes();
              const totalMinutos = hora * 60 + minutos;

              const kmSegmento = parseFloat(paradaSiguiente.odometro) - parseFloat(paradaActual.odometro);

              if ((diaSemana === 6 && totalMinutos > 780) || diaSemana === 0) {
                km_100x100 += kmSegmento;
              } else {
                km_comunes += kmSegmento;
              }
            }
          }

          tramosDetallados.push({
            viaje_id: viaje.viaje_id,
            fecha_salida: paradaInicio?.fecha_hora || viaje.fecha_hora_salida,
            origen: origenTramo,
            fecha_llegada: paradaFin?.fecha_hora || null,
            destino: destinoTramo,
            km_comunes: km_comunes,
            km_100x100: km_100x100,
            tractor_marca: viaje.tractor_marca,
            tractor_modelo: viaje.tractor_modelo,
            tractor_dominio: viaje.tractor_dominio
          });
        }
      }
    }

    res.json(tramosDetallados);
  } catch (error) {
    console.error("Error al obtener viajes detallados por chofer:", error);
    res.status(500).json({ error: "Error al obtener viajes detallados" });
  }
}
