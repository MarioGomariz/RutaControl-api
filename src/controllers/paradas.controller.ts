import { Request, Response } from "express";
import { pool } from "../db/pool.js";
import type { Parada, CreateParadaDTO } from "../types/parada.js";

/** GET /api/paradas/viaje/:viaje_id - Obtener todas las paradas de un viaje */
export async function listarParadasPorViaje(
  req: Request<{ viaje_id: string }>,
  res: Response
) {
  try {
    const { viaje_id } = req.params;
    const [rows] = await pool.query(
      `SELECT * FROM paradas WHERE viaje_id = ? ORDER BY fecha_hora ASC`,
      [viaje_id]
    );
    res.json(rows as Parada[]);
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
  if (!body.viaje_id || !body.odometro || !body.ubicacion || !body.tipo) {
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

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Verificar que el viaje existe
    const [[viaje]]: any = await conn.query(
      "SELECT id, estado FROM viaje WHERE id = ? LIMIT 1",
      [body.viaje_id]
    );

    if (!viaje) {
      await conn.rollback();
      return res.status(404).json({ error: "Viaje no encontrado" });
    }

    // Si es tipo inicio, cambiar estado del viaje a 'en curso'
    if (body.tipo === 'inicio') {
      // Verificar que no haya otra parada de inicio
      const [[paradaInicio]]: any = await conn.query(
        "SELECT id FROM paradas WHERE viaje_id = ? AND tipo = 'inicio' LIMIT 1",
        [body.viaje_id]
      );

      if (paradaInicio) {
        await conn.rollback();
        return res.status(400).json({
          error: "Ya existe una parada de inicio para este viaje",
        });
      }

      // Cambiar estado del viaje a 'en curso'
      await conn.query(
        "UPDATE viaje SET estado = 'en curso' WHERE id = ?",
        [body.viaje_id]
      );

      // Cambiar estado del tractor y semirremolque a 'en viaje'
      const [[viajeData]]: any = await conn.query(
        "SELECT tractor_id, semirremolque_id FROM viaje WHERE id = ? LIMIT 1",
        [body.viaje_id]
      );
      if (viajeData?.tractor_id) {
        await conn.query(
          "UPDATE tractores SET estado = 'en viaje' WHERE id = ?",
          [viajeData.tractor_id]
        );
      }
      if (viajeData?.semirremolque_id) {
        await conn.query(
          "UPDATE semirremolques SET estado = 'en viaje' WHERE id = ?",
          [viajeData.semirremolque_id]
        );
      }
    }

    // Verificar que el odómetro no sea menor que paradas previas
    const [[maxOdometro]]: any = await conn.query(
      "SELECT MAX(odometro) as max_odometro FROM paradas WHERE viaje_id = ?",
      [body.viaje_id]
    );

    if (maxOdometro?.max_odometro && body.odometro < maxOdometro.max_odometro) {
      await conn.rollback();
      return res.status(400).json({
        error: `El odómetro (${body.odometro} km) no puede ser menor que el odómetro previo (${maxOdometro.max_odometro} km)`,
      });
    }

    // Si es tipo llegada, verificar que el destino existe
    if (body.tipo === 'llegada' && body.destino_id) {
      const [[destino]]: any = await conn.query(
        "SELECT id FROM destinos WHERE id = ? AND viaje_id = ? LIMIT 1",
        [body.destino_id, body.viaje_id]
      );

      if (!destino) {
        await conn.rollback();
        return res.status(404).json({
          error: "Destino no encontrado o no pertenece a este viaje",
        });
      }
    }

    // Insertar la parada
    const [result] = await conn.query(
      `INSERT INTO paradas (viaje_id, odometro, ubicacion, tipo, destino_id)
       VALUES (?, ?, ?, ?, ?)`,
      [
        body.viaje_id,
        body.odometro,
        body.ubicacion,
        body.tipo,
        body.destino_id || null,
      ]
    );

    const paradaId = (result as any).insertId;

    await conn.commit();
    res.status(201).json({ id: paradaId });
  } catch (e: any) {
    await conn.rollback();
    console.error(e);
    res.status(500).json({ error: e?.message || "Error al crear parada" });
  } finally {
    conn.release();
  }
}

/** PUT /api/viajes/:viaje_id/finalizar - Finalizar un viaje */
export async function finalizarViaje(
  req: Request<{ viaje_id: string }>,
  res: Response
) {
  const { viaje_id } = req.params;
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    // Obtener el viaje y sus destinos
    const [[viaje]]: any = await conn.query(
      "SELECT id, cantidad_destinos, estado FROM viaje WHERE id = ? LIMIT 1",
      [viaje_id]
    );

    if (!viaje) {
      await conn.rollback();
      return res.status(404).json({ error: "Viaje no encontrado" });
    }

    if (viaje.estado === 'finalizado') {
      await conn.rollback();
      return res.status(400).json({ error: "El viaje ya está finalizado" });
    }

    // Contar paradas de tipo llegada
    const [[count]]: any = await conn.query(
      "SELECT COUNT(*) as total FROM paradas WHERE viaje_id = ? AND tipo = 'llegada'",
      [viaje_id]
    );

    if (count.total < viaje.cantidad_destinos) {
      await conn.rollback();
      return res.status(400).json({
        error: `Faltan paradas de llegada. Se requieren ${viaje.cantidad_destinos}, solo hay ${count.total}`,
      });
    }

    // Actualizar estado del viaje a finalizado
    await conn.query(
      "UPDATE viaje SET estado = 'finalizado' WHERE id = ?",
      [viaje_id]
    );

    // Cambiar estado del tractor y semirremolque a 'disponible'
    const [[viajeData]]: any = await conn.query(
      "SELECT tractor_id, semirremolque_id FROM viaje WHERE id = ? LIMIT 1",
      [viaje_id]
    );
    if (viajeData?.tractor_id) {
      await conn.query(
        "UPDATE tractores SET estado = 'disponible' WHERE id = ?",
        [viajeData.tractor_id]
      );
    }
    if (viajeData?.semirremolque_id) {
      await conn.query(
        "UPDATE semirremolques SET estado = 'disponible' WHERE id = ?",
        [viajeData.semirremolque_id]
      );
    }

    await conn.commit();
    res.json({ ok: true, message: "Viaje finalizado exitosamente" });
  } catch (e) {
    await conn.rollback();
    console.error(e);
    res.status(500).json({ error: "Error al finalizar viaje" });
  } finally {
    conn.release();
  }
}

/** GET /api/paradas/viaje/:viaje_id/export - Exportar información de paradas */
export async function exportarParadas(
  req: Request<{ viaje_id: string }>,
  res: Response
) {
  try {
    const { viaje_id } = req.params;

    // Obtener información del viaje
    const [[viaje]]: any = await pool.query(
      `SELECT v.*, 
              c.nombre as chofer_nombre, c.apellido as chofer_apellido,
              t.marca as tractor_marca, t.modelo as tractor_modelo, t.dominio as tractor_dominio,
              s.nombre as semirremolque_nombre, s.dominio as semirremolque_dominio,
              srv.nombre as servicio_nombre
       FROM viaje v
       LEFT JOIN chofer c ON v.chofer_id = c.id
       LEFT JOIN tractores t ON v.tractor_id = t.id
       LEFT JOIN semirremolque s ON v.semirremolque_id = s.id
       LEFT JOIN servicios srv ON v.servicio_id = srv.id
       WHERE v.id = ? LIMIT 1`,
      [viaje_id]
    );

    if (!viaje) {
      return res.status(404).json({ error: "Viaje no encontrado" });
    }

    // Obtener paradas
    const [paradas] = await pool.query(
      `SELECT p.*, d.ubicacion as destino_ubicacion
       FROM paradas p
       LEFT JOIN destinos d ON p.destino_id = d.id
       WHERE p.viaje_id = ?
       ORDER BY p.fecha_hora ASC`,
      [viaje_id]
    );

    // Obtener destinos
    const [destinos] = await pool.query(
      "SELECT * FROM destinos WHERE viaje_id = ? ORDER BY orden ASC",
      [viaje_id]
    );

    res.json({
      viaje,
      paradas,
      destinos,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error al exportar paradas" });
  }
}
