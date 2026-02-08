import { Request, Response } from "express";
import { pool } from "../db/pool.js";
import type { Viaje, ViajeDestino } from "../types/viaje.js";
import { toSqlDate, toSqlDateTime } from "../helpers/dateTransforme.js";

/** GET /api/viajes */
export async function listarViajes(_req: Request, res: Response) {
  try {
    const [rows] = await pool.query(
      `SELECT 
         v.*,
         t.marca as tractor_marca,
         t.modelo as tractor_modelo,
         t.dominio as tractor_dominio,
         t.estado as tractor_estado
       FROM viaje v
       LEFT JOIN tractores t ON v.tractor_id = t.id
       ORDER BY v.id DESC`
    );
    res.json(rows as any[]);
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
    const [[viaje]]: any = await pool.query(
      "SELECT * FROM viaje WHERE id = ? LIMIT 1",
      [id]
    );
    if (!viaje) return res.status(404).json({ error: "Viaje no encontrado" });

    const [destinos] = await pool.query(
      "SELECT * FROM destinos WHERE viaje_id = ? ORDER BY orden ASC",
      [id]
    );

    res.json({ ...viaje, destinos });
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
    const [rows] = await pool.query(
      `SELECT 
         v.*,
         t.marca as tractor_marca,
         t.modelo as tractor_modelo,
         t.dominio as tractor_dominio,
         t.estado as tractor_estado
       FROM viaje v
       LEFT JOIN tractores t ON v.tractor_id = t.id
       WHERE v.chofer_id = ? 
       ORDER BY v.fecha_hora_salida DESC`,
      [chofer_id]
    );
    res.json(rows as any[]);
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
      return res
        .status(400)
        .json({ error: `Campo obligatorio faltante: ${k}` });
    }
  }
  if (!["nacional", "internacional"].includes(body.alcance))
    return res.status(400).json({ error: "alcance inválido" });
  if (!["programado", "en curso", "finalizado"].includes(body.estado))
    return res.status(400).json({ error: "estado inválido" });

  const destinos = body.destinos ?? [];

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Validar foreign keys existen mínimamente
    const checks = [
      conn.query("SELECT id FROM chofer WHERE id = ? LIMIT 1", [
        body.chofer_id,
      ]),
      conn.query("SELECT id, estado FROM tractores WHERE id = ? LIMIT 1", [
        body.tractor_id,
      ]),
      conn.query("SELECT id FROM semirremolque WHERE id = ? LIMIT 1", [
        body.semirremolque_id,
      ]),
      conn.query("SELECT id FROM servicios WHERE id = ? LIMIT 1", [
        body.servicio_id,
      ]),
    ];
    const results = await Promise.all(checks);
    if (results.some(([r]: any) => !r.length)) {
      throw new Error(
        "Alguna referencia (chofer/tractor/semi/servicio) no existe"
      );
    }

    // Validar que el tractor no esté en uso, reparación o fuera de servicio
    const [[tractor]]: any = results[1];
    const estadosNoPermitidos = ['en reparacion', 'fuera de servicio'];
    if (estadosNoPermitidos.includes(tractor.estado)) {
      const estadoMensajes: Record<string, string> = {
        'en reparacion': 'El tractor está en reparación',
        'fuera de servicio': 'El tractor está fuera de servicio'
      };
      throw new Error(estadoMensajes[tractor.estado] || 'El tractor no está disponible');
    }

    const [r] = await conn.query(
      `INSERT INTO viaje
      (chofer_id, tractor_id, semirremolque_id, servicio_id,
       alcance, origen, cantidad_destinos, fecha_hora_salida, estado)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        body.chofer_id,
        body.tractor_id,
        body.semirremolque_id,
        body.servicio_id,
        body.alcance,
        body.origen,
        destinos.length,
        toSqlDateTime(body.fecha_hora_salida),
        body.estado,
      ]
    );
    const viajeId = (r as any).insertId;

    // Si el viaje se crea en estado 'en curso', actualizar estados de unidades
    if (body.estado === 'en curso') {
      await conn.query(
        "UPDATE tractores SET estado = 'en viaje' WHERE id = ?",
        [body.tractor_id]
      );
      await conn.query(
        "UPDATE semirremolques SET estado = 'en viaje' WHERE id = ?",
        [body.semirremolque_id]
      );
    }

    // Insertar destinos (si vienen)
    for (const d of destinos) {
      if (typeof d.orden !== "number" || !d.ubicacion) {
        await conn.rollback();
        return res
          .status(400)
          .json({
            error:
              "Destino inválido: requiere orden (number) y ubicacion (string)",
          });
      }
      await conn.query(
        "INSERT INTO destinos (viaje_id, orden, ubicacion) VALUES (?, ?, ?)",
        [viajeId, d.orden, d.ubicacion]
      );
    }

    await conn.commit();
    res.status(201).json({ id: viajeId });
  } catch (e: any) {
    await conn.rollback();
    const msg = e?.message || "Error al crear viaje";
    console.error(e);
    res.status(400).json({ error: msg });
  } finally {
    conn.release();
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
  const { id } = req.params;
  const b = req.body;
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    // Obtener el estado actual del viaje y las unidades asignadas
    const [[viajeActual]]: any = await conn.query(
      "SELECT estado, tractor_id, semirremolque_id FROM viaje WHERE id = ? LIMIT 1",
      [id]
    );

    if (!viajeActual) {
      await conn.rollback();
      return res.status(404).json({ error: "Viaje no encontrado" });
    }

    const estadoAnterior = viajeActual.estado;
    const nuevoEstado = b.estado ?? estadoAnterior;

    // update básico del viaje
    const [r] = await conn.query(
      `UPDATE viaje SET
        chofer_id = COALESCE(?, chofer_id),
        tractor_id = COALESCE(?, tractor_id),
        semirremolque_id = COALESCE(?, semirremolque_id),
        servicio_id = COALESCE(?, servicio_id),
        alcance = COALESCE(?, alcance),
        origen = COALESCE(?, origen),
        fecha_hora_salida = COALESCE(?, fecha_hora_salida),
        estado = COALESCE(?, estado)
      WHERE id = ?`,
      [
        b.chofer_id ?? null,
        b.tractor_id ?? null,
        b.semirremolque_id ?? null,
        b.servicio_id ?? null,
        b.alcance ?? null,
        b.origen ?? null,
        b.fecha_hora_salida ? toSqlDateTime(b.fecha_hora_salida) : null,
        b.estado ?? null,
        id,
      ]
    );

    if ((r as any).affectedRows === 0) {
      await conn.rollback();
      return res.status(404).json({ error: "Viaje no encontrado" });
    }

    // Actualizar estados de unidades según cambio de estado del viaje
    const tractorId = b.tractor_id ?? viajeActual.tractor_id;
    const semirremolqueId = b.semirremolque_id ?? viajeActual.semirremolque_id;

    // Si el viaje pasa de 'programado' a 'en curso'
    if (estadoAnterior === 'programado' && nuevoEstado === 'en curso') {
      await conn.query(
        "UPDATE tractores SET estado = 'en viaje' WHERE id = ?",
        [tractorId]
      );
      await conn.query(
        "UPDATE semirremolques SET estado = 'en viaje' WHERE id = ?",
        [semirremolqueId]
      );
    }

    // Si el viaje pasa a 'finalizado'
    if (nuevoEstado === 'finalizado' && estadoAnterior !== 'finalizado') {
      await conn.query(
        "UPDATE tractores SET estado = 'disponible' WHERE id = ?",
        [tractorId]
      );
      await conn.query(
        "UPDATE semirremolques SET estado = 'disponible' WHERE id = ?",
        [semirremolqueId]
      );
    }

    // si vienen destinos -> reemplazar todos
    if (b.destinos) {
      await conn.query("DELETE FROM destinos WHERE viaje_id = ?", [id]);
      for (const d of b.destinos) {
        if (typeof d.orden !== "number" || !d.ubicacion) {
          await conn.rollback();
          return res
            .status(400)
            .json({
              error:
                "Destino inválido: requiere orden (number) y ubicacion (string)",
            });
        }
        await conn.query(
          "INSERT INTO destinos (viaje_id, orden, ubicacion) VALUES (?, ?, ?)",
          [id, d.orden, d.ubicacion]
        );
      }
      await conn.query("UPDATE viaje SET cantidad_destinos = ? WHERE id = ?", [
        b.destinos.length,
        id,
      ]);
    }

    await conn.commit();
    res.json({ ok: true });
  } catch (e) {
    await conn.rollback();
    console.error(e);
    res.status(500).json({ error: "Error al actualizar viaje" });
  } finally {
    conn.release();
  }
}

/** DELETE /api/viajes/:id  (borra destinos por ON DELETE CASCADE) */
export async function eliminarViaje(
  req: Request<{ id: string }>,
  res: Response
) {
  const { id } = req.params;
  const conn = await pool.getConnection();
  
  try {
    await conn.beginTransaction();
    
    // Obtener las unidades asignadas antes de eliminar el viaje
    const [[viaje]]: any = await conn.query(
      "SELECT tractor_id, semirremolque_id, estado FROM viaje WHERE id = ? LIMIT 1",
      [id]
    );
    
    if (!viaje) {
      await conn.rollback();
      return res.status(404).json({ error: "Viaje no encontrado" });
    }
    
    // Eliminar el viaje
    await conn.query("DELETE FROM viaje WHERE id = ?", [id]);
    
    // Cambiar estado de las unidades a 'disponible' solo si el viaje no estaba finalizado
    if (viaje.estado !== 'finalizado') {
      if (viaje.tractor_id) {
        await conn.query(
          "UPDATE tractores SET estado = 'disponible' WHERE id = ?",
          [viaje.tractor_id]
        );
      }
      if (viaje.semirremolque_id) {
        await conn.query(
          "UPDATE semirremolques SET estado = 'disponible' WHERE id = ?",
          [viaje.semirremolque_id]
        );
      }
    }
    
    await conn.commit();
    res.json({ ok: true });
  } catch (e) {
    await conn.rollback();
    console.error(e);
    res.status(500).json({ error: "Error al eliminar viaje" });
  } finally {
    conn.release();
  }
}

