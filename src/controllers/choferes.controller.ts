import { Request, Response } from "express";
import { pool } from "../db/pool.js";
import { hashPassword } from "../utils/password.js";
import crypto from "crypto";
import type { Chofer } from "../types/chofer.js";
import { toSqlDate } from "../helpers/dateTransforme.js";

type CrearChoferBody = Chofer;

export async function crearChofer(
  req: Request<{}, {}, CrearChoferBody>,
  res: Response
) {
  const body = req.body;
  console.log('[CREAR_CHOFER] Iniciando creación de chofer:', body.email);

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
    if (body[k] === undefined || body[k] === null || body[k] === "") {
      console.log('[CREAR_CHOFER] Error: Campo faltante:', k);
      return res
        .status(400)
        .json({ error: `Campo obligatorio faltante: ${k}` });
    }
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    
    // Verificar DNI duplicado
    const [[dupDni]]: any = await conn.query(
      "SELECT id FROM chofer WHERE dni = ? LIMIT 1",
      [body.dni]
    );
    if (dupDni) throw new Error("Ya existe un chofer registrado con ese DNI");
    
    // Verificar email duplicado
    const [[dupEmail]]: any = await conn.query(
      "SELECT id FROM chofer WHERE email = ? LIMIT 1",
      [body.email]
    );
    if (dupEmail) throw new Error("Ya existe un chofer registrado con ese email");
    
    // Verificar licencia duplicada
    const [[dupLicencia]]: any = await conn.query(
      "SELECT id FROM chofer WHERE licencia = ? LIMIT 1",
      [body.licencia]
    );
    if (dupLicencia) throw new Error("Ya existe un chofer registrado con ese número de licencia");

    // Password temporal (en prod: enviar flujo de seteo)
    const temp = crypto.randomUUID().slice(0, 10);
    console.log('[CREAR_CHOFER] Password temporal generada:', temp);
    
    const hash = await hashPassword(temp);
    console.log('[CREAR_CHOFER] Hash generado, longitud:', hash.length);

    // Usuario (rol 2)
    console.log('[CREAR_CHOFER] Creando usuario con email:', body.email);
    const [uRes] = await conn.query(
      `INSERT INTO usuario (usuario, contrasena, rol_id)
       VALUES (?, ?, ?)`,
      [body.email, hash, 2]
    );

    const usuarioId = (uRes as any).insertId;
    console.log('[CREAR_CHOFER] Usuario creado con ID:', usuarioId);

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
    console.log('[CREAR_CHOFER] Chofer creado exitosamente, ID:', (cRes as any).insertId);
    return res.status(201).json({
      chofer_id: (cRes as any).insertId,
      usuario_id: usuarioId,
      password_temporal: temp, // solo dev para testear
    });
  } catch (e: any) {
    await conn.rollback();
    console.error('[CREAR_CHOFER] Error al crear chofer:', e);
    if (e?.message) return res.status(400).json({ error: e.message });
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
    
    // Verificar duplicados si se están actualizando esos campos
    if (body.dni) {
      const [[dupDni]]: any = await conn.query(
        "SELECT id FROM chofer WHERE dni = ? AND id != ? LIMIT 1",
        [body.dni, id]
      );
      if (dupDni) {
        await conn.rollback();
        return res.status(400).json({ error: "Ya existe un chofer registrado con ese DNI" });
      }
    }
    
    if (body.email) {
      const [[dupEmail]]: any = await conn.query(
        "SELECT id FROM chofer WHERE email = ? AND id != ? LIMIT 1",
        [body.email, id]
      );
      if (dupEmail) {
        await conn.rollback();
        return res.status(400).json({ error: "Ya existe un chofer registrado con ese email" });
      }
    }
    
    if (body.licencia) {
      const [[dupLicencia]]: any = await conn.query(
        "SELECT id FROM chofer WHERE licencia = ? AND id != ? LIMIT 1",
        [body.licencia, id]
      );
      if (dupLicencia) {
        await conn.rollback();
        return res.status(400).json({ error: "Ya existe un chofer registrado con ese número de licencia" });
      }
    }

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

export async function actualizarPasswordChofer(
  req: Request<{ id: string }, {}, { password: string }>,
  res: Response
) {
  const { id } = req.params;
  const { password } = req.body;
  
  console.log('[ACTUALIZAR_PASSWORD] Actualizando password para chofer ID:', id);
  console.log('[ACTUALIZAR_PASSWORD] Longitud de password recibida:', password?.length);

  if (!password || password.length < 6) {
    console.log('[ACTUALIZAR_PASSWORD] Error: Password muy corta o vacía');
    return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Obtener el usuario_id del chofer
    const [[chofer]]: any = await conn.query(
      "SELECT usuario_id FROM chofer WHERE id = ? LIMIT 1",
      [id]
    );

    if (!chofer || !chofer.usuario_id) {
      await conn.rollback();
      console.log('[ACTUALIZAR_PASSWORD] Error: Chofer no encontrado o sin usuario');
      return res.status(404).json({ error: "Chofer no encontrado o sin usuario asociado" });
    }
    
    console.log('[ACTUALIZAR_PASSWORD] Chofer encontrado, usuario_id:', chofer.usuario_id);

    // Hashear la nueva contraseña
    const hash = await hashPassword(password);
    console.log('[ACTUALIZAR_PASSWORD] Hash generado, longitud:', hash.length);

    // Actualizar la contraseña del usuario
    const [result]: any = await conn.query(
      "UPDATE usuario SET contrasena = ? WHERE id = ?",
      [hash, chofer.usuario_id]
    );
    
    console.log('[ACTUALIZAR_PASSWORD] Filas afectadas:', result.affectedRows);

    await conn.commit();
    console.log('[ACTUALIZAR_PASSWORD] Contraseña actualizada exitosamente');
    return res.status(200).json({ message: "Contraseña actualizada correctamente" });
  } catch (e) {
    await conn.rollback();
    console.error('[ACTUALIZAR_PASSWORD] Error inesperado:', e);
    return res.status(500).json({ error: "Error al actualizar la contraseña" });
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
  } catch (e: any) {
    await conn.rollback();
    console.error('Error al eliminar chofer:', e);
    
    // Detectar error de restricción de clave foránea
    if (e?.code === 'ER_ROW_IS_REFERENCED_2' || e?.errno === 1451) {
      return res.status(400).json({ 
        error: 'No se puede eliminar el chofer porque está asignado a uno o más viajes',
        code: e.code,
        sqlMessage: e.sqlMessage
      });
    }
    return res.status(500).json({ error: "Error al eliminar chofer" });
  } finally {
    conn.release();
  }
}
