import { Request, Response } from "express";
import { pool } from "../db/pool";
import { hashPassword } from "../utils/password";
import crypto from "crypto";
import type { Chofer } from "../types/chofer";
import { toSqlDate } from "../helpers/dateTransforme";

type CrearChoferBody = Chofer;

export async function crearChofer(
  req: Request<{}, {}, CrearChoferBody>,
  res: Response
) {
  const body = req.body;

  // Validación mínima
  const required: Array<keyof CrearChoferBody> = [
    "nombre",
    "apellido",
    "dni",
    "telefono",
    "email",
    "licencia",
    "fecha_vencimiento_licencia",
    "activo",
  ];
  for (const k of required) {
    if (body[k] === undefined || body[k] === null || body[k] === "")
      return res
        .status(400)
        .json({ error: `Campo obligatorio faltante: ${k}` });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [[dupC]]: any = await conn.query(
      "SELECT id FROM chofer WHERE dni = ? OR email = ? LIMIT 1",
      [body.dni, body.email]
    );
    if (dupC) throw new Error("DNI o email ya existente");

    // Password temporal (en prod: enviar flujo de seteo)
    const temp = crypto.randomUUID().slice(0, 10);
    const hash = await hashPassword(temp);

    // Usuario (rol 2)
    const [uRes] = await conn.query(
      `INSERT INTO usuario (usuario, contrasena, rol_id)
       VALUES (?, ?, ?)`,
      [body.email, hash, 2]
    );

    const usuarioId = (uRes as any).insertId;

    // Chofer
    const [cRes] = await conn.query(
      `INSERT INTO chofer
      (nombre, apellido, dni, telefono, email, licencia, fecha_vencimiento_licencia, activo, usuario_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        body.nombre,
        body.apellido,
        body.dni,
        body.telefono,
        body.email,
        body.licencia,
        toSqlDate(body.fecha_vencimiento_licencia),
        body.activo ? 1 : 0,
        usuarioId,
      ]
    );

    await conn.commit();
    return res.status(201).json({
      chofer_id: (cRes as any).insertId,
      usuario_id: usuarioId,
      password_temporal: temp, // solo dev para testear
    });
  } catch (e: any) {
    await conn.rollback();
    if (e?.message) return res.status(400).json({ error: e.message });
    console.error(e);
    return res.status(500).json({ error: "Error al crear chofer" });
  } finally {
    conn.release();
  }
}

export async function listarChoferes(_req: Request, res: Response) {
  try {
    const [rows] = await pool.query(
      `SELECT
         c.id AS id,
         c.nombre,
         c.apellido,
         c.dni,
         c.telefono,
         c.email AS email,
         c.licencia,
         c.fecha_vencimiento_licencia,
         c.activo AS activo,
         c.usuario_id AS usuario_id,
         u.usuario AS usuario,
         u.rol_id AS rol_id
       FROM chofer c
       JOIN usuario u ON u.id = c.usuario_id
       ORDER BY c.id DESC`
    );
    res.json(rows as any[]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error al listar choferes" });
  }
}

export async function obtenerChofer(
  req: Request<{ id: string }>,
  res: Response
) {
  try {
    const { id } = req.params;
    const [rows] = await pool.query(
      `SELECT
         c.id AS id,
         c.nombre,
         c.apellido,
         c.dni,
         c.telefono,
         c.email AS email,
         c.licencia,
         c.fecha_vencimiento_licencia,
         c.activo AS activo,
         c.usuario_id AS usuario_id,
         u.usuario AS usuario,
         u.rol_id AS rol_id
       FROM chofer c
       JOIN usuario u ON u.id = c.usuario_id
       WHERE c.id = ? LIMIT 1`,
      [id]
    );
    const row = (rows as any[])[0] as any | undefined;
    if (!row) return res.status(404).json({ error: "Chofer no encontrado" });
    res.json(row);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error al obtener chofer" });
  }
}

export async function actualizarChofer(
  req: Request<{ id: string }>,
  res: Response
) {
  const { id } = req.params;
  const body = req.body as Partial<Chofer>;

  // Campos permitidos para actualizar
  const allowed: Array<keyof Chofer> = [
    "nombre",
    "apellido",
    "dni",
    "telefono",
    "email",
    "licencia",
    "fecha_vencimiento_licencia",
    "activo",
  ];

  // Construir SET dinámico solo con campos presentes
  const setParts: string[] = [];
  const values: any[] = [];

  for (const key of allowed) {
    if (Object.prototype.hasOwnProperty.call(body, key)) {
      if (key === "activo" && body.activo !== undefined) {
        setParts.push(`${key} = ?`);
        values.push(body.activo ? 1 : 0);
      } else if (key !== "activo") {
        setParts.push(`${key} = ?`);
        values.push((body as any)[key]);
      }
    }
  }

  if (setParts.length === 0) {
    return res
      .status(400)
      .json({ error: "No se proporcionaron campos para actualizar" });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Si cambia el email, mantener en sync el usuario.usuario
    const updatesEmail = Object.prototype.hasOwnProperty.call(body, "email");

    // Actualizar chofer dinámicamente
    const sql = `UPDATE chofer SET ${setParts.join(", ")} WHERE id = ?`;
    const [cRes]: any = await conn.query(sql, [...values, id]);

    if (cRes.affectedRows === 0) {
      await conn.rollback();
      return res.status(404).json({ error: "Chofer no encontrado" });
    }

    if (updatesEmail) {
      // actualizar el usuario vinculado si existe cambio de email
      await conn.query(
        `UPDATE usuario 
         SET usuario = ? 
         WHERE id = (SELECT usuario_id FROM chofer WHERE id = ?)`,
        [body.email, id]
      );
    }

    await conn.commit();

    // Devolver el recurso actualizado
    const [rows] = await conn.query(
      `SELECT
         c.id AS chofer_id,
         c.nombre,
         c.apellido,
         c.dni,
         c.telefono,
         c.email AS chofer_email,
         c.licencia,
         c.fecha_vencimiento_licencia,
         c.activo AS chofer_activo,
         c.usuario_id AS chofer_usuario_id,
         u.id AS usuario_id,
         u.usuario AS usuario,
         u.rol_id AS usuario_rol_id,
         u.activo AS usuario_activo
       FROM chofer c
       JOIN usuario u ON u.id = c.usuario_id
       WHERE c.id = ? LIMIT 1`,
      [id]
    );
    const row = (rows as any[])[0];
    return res.status(200).json({ actualizado: true, chofer: row });
  } catch (e) {
    await conn.rollback();
    console.error(e);
    return res.status(500).json({ error: "Error al actualizar chofer" });
  } finally {
    conn.release();
  }
}

export async function eliminarChofer(
  req: Request<{ id: string }>,
  res: Response
) {
  const { id } = req.params;
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [[chofer]]: any = await conn.query(
      "SELECT id, usuario_id FROM chofer WHERE id = ? LIMIT 1",
      [id]
    );
    if (!chofer) {
      await conn.rollback();
      return res.status(404).json({ error: "Chofer no encontrado" });
    }
    // Primero borrar chofer (evita conflictos de FK si no hay ON DELETE SET NULL)
    await conn.query("DELETE FROM chofer WHERE id = ?", [id]);
    // Luego borrar usuario asociado (si existe)
    if (chofer.usuario_id) {
      await conn.query("DELETE FROM usuario WHERE id = ?", [chofer.usuario_id]);
    }
    await conn.commit();
    return res.status(200).json({ eliminado: true });
  } catch (e) {
    await conn.rollback();
    console.error(e);
    return res.status(500).json({ error: "Error al eliminar chofer" });
  } finally {
    conn.release();
  }
}
