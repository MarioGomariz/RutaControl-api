import { Request, Response } from "express";
import { prisma } from "../db/prisma.js";
import { hashPassword } from "../utils/password.js";
import crypto from "crypto";
import type { Chofer } from "../types/chofer.js";

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

  try {
    // Password temporal
    const temp = crypto.randomUUID().slice(0, 10);
    console.log('[CREAR_CHOFER] Password temporal generada:', temp);
    
    const hash = await hashPassword(temp);
    console.log('[CREAR_CHOFER] Hash generado');

    const estadoInicial = body.activo ? 'disponible' : 'inactivo';

    const result = await prisma.$transaction(async (tx) => {
      // Verificar DNI duplicado
      const dupDni = await tx.chofer.findUnique({ where: { dni: body.dni } });
      if (dupDni) throw new Error("Ya existe un chofer registrado con ese DNI");
      
      // Verificar email duplicado
      const dupEmail = await tx.chofer.findUnique({ where: { email: body.email } });
      if (dupEmail) throw new Error("Ya existe un chofer registrado con ese email");
      
      // Verificar licencia duplicada
      if (body.licencia) {
        const dupLic = await tx.chofer.findFirst({ where: { licencia: body.licencia } });
        if (dupLic) throw new Error("Ya existe un chofer registrado con ese número de licencia");
      }

      const usuario = await tx.usuario.create({
        data: {
          usuario: body.email,
          contrasena: hash,
          rol_id: 2,
          activo: body.activo
        }
      });

      const chofer = await tx.chofer.create({
        data: {
          nombre: body.nombre,
          apellido: body.apellido,
          dni: body.dni,
          telefono: body.telefono,
          email: body.email,
          licencia: body.licencia,
          fecha_vencimiento_licencia: body.fecha_vencimiento_licencia ? new Date(body.fecha_vencimiento_licencia) : null,
          activo: body.activo,
          estado: estadoInicial,
          usuario_id: usuario.id
        }
      });

      return { chofer, usuario };
    });

    console.log('[CREAR_CHOFER] Chofer creado exitosamente, ID:', result.chofer.id);
    
    const choferCompleto = {
      ...result.chofer,
      usuario: result.usuario.usuario,
      rol_id: result.usuario.rol_id,
      password_temporal: temp
    };
    
    return res.status(201).json(choferCompleto);
  } catch (e: any) {
    console.error('[CREAR_CHOFER] Error al crear chofer:', e);
    if (e?.message) return res.status(400).json({ error: e.message });
    return res.status(500).json({ error: "Error al crear chofer" });
  }
}

export async function listarChoferes(_req: Request, res: Response) {
  try {
    const choferes = await prisma.chofer.findMany({
      include: {
        usuario: true
      },
      orderBy: {
        id: 'desc'
      }
    });

    const rows = choferes.map(c => ({
      id: c.id,
      nombre: c.nombre,
      apellido: c.apellido,
      dni: c.dni,
      telefono: c.telefono,
      email: c.email,
      licencia: c.licencia,
      fecha_vencimiento_licencia: c.fecha_vencimiento_licencia?.toISOString().split('T')[0] || null,
      activo: c.activo,
      estado: c.estado,
      usuario_id: c.usuario_id,
      usuario: c.usuario?.usuario,
      rol_id: c.usuario?.rol_id
    }));

    res.json(rows);
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
    const chofer = await prisma.chofer.findUnique({
      where: { id: Number(id) },
      include: { usuario: true }
    });

    if (!chofer) return res.status(404).json({ error: "Chofer no encontrado" });

    res.json({
      ...chofer,
      fecha_vencimiento_licencia: chofer.fecha_vencimiento_licencia?.toISOString().split('T')[0] || null,
      usuario: chofer.usuario?.usuario,
      rol_id: chofer.usuario?.rol_id
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error al obtener chofer" });
  }
}

export async function actualizarChofer(
  req: Request<{ id: string }>,
  res: Response
) {
  const idStr = req.params.id;
  const id = Number(idStr);
  const body = req.body as Partial<Chofer>;

  if (Object.keys(body).length === 0) {
    return res.status(400).json({ error: "No se proporcionaron campos para actualizar" });
  }

  try {
    const choferActualizado = await prisma.$transaction(async (tx) => {
      // Verificar si existe el chofer
      const existing = await tx.chofer.findUnique({ where: { id } });
      if (!existing) throw new Error("Chofer no encontrado");

      // Si se intenta cambiar a inactivo, verificar que no tenga viajes en curso
      if (body.activo === false || body.estado === 'inactivo') {
        const viajeActivo = await tx.viaje.findFirst({
          where: {
            chofer_id: id,
            estado: 'en_curso'
          }
        });
        
        if (viajeActivo) {
          throw new Error('No se puede desactivar el chofer porque tiene un viaje en curso');
        }
      }

      // Validar duplicados si vienen
      if (body.dni && body.dni !== existing.dni) {
        const dup = await tx.chofer.findUnique({ where: { dni: body.dni } });
        if (dup) throw new Error("Ya existe un chofer registrado con ese DNI");
      }
      if (body.email && body.email !== existing.email) {
        const dup = await tx.chofer.findUnique({ where: { email: body.email } });
        if (dup) throw new Error("Ya existe un chofer registrado con ese email");
      }

      let nuevoEstado = body.estado;
      if (body.activo === false && !body.estado) {
        nuevoEstado = 'inactivo';
      } else if (body.activo === true && !body.estado) {
        nuevoEstado = 'disponible';
      }

      // Preparamos data para chofer
      const dataToUpdate: any = {};
      if (body.nombre !== undefined) dataToUpdate.nombre = body.nombre;
      if (body.apellido !== undefined) dataToUpdate.apellido = body.apellido;
      if (body.dni !== undefined) dataToUpdate.dni = body.dni;
      if (body.telefono !== undefined) dataToUpdate.telefono = body.telefono;
      if (body.email !== undefined) dataToUpdate.email = body.email;
      if (body.licencia !== undefined) dataToUpdate.licencia = body.licencia;
      if (body.fecha_vencimiento_licencia !== undefined) {
        dataToUpdate.fecha_vencimiento_licencia = body.fecha_vencimiento_licencia ? new Date(body.fecha_vencimiento_licencia) : null;
      }
      if (body.activo !== undefined) dataToUpdate.activo = body.activo;
      if (nuevoEstado !== undefined) dataToUpdate.estado = nuevoEstado;

      const chofer = await tx.chofer.update({
        where: { id },
        data: dataToUpdate,
        include: { usuario: true }
      });

      // Actualizar email de usuario si cambió
      if (body.email && existing.usuario_id) {
        await tx.usuario.update({
          where: { id: existing.usuario_id },
          data: { usuario: body.email }
        });
        // Refrescar include
        if (chofer.usuario) chofer.usuario.usuario = body.email;
      }

      return chofer;
    });

    const dto = {
      chofer_id: choferActualizado.id,
      nombre: choferActualizado.nombre,
      apellido: choferActualizado.apellido,
      dni: choferActualizado.dni,
      telefono: choferActualizado.telefono,
      chofer_email: choferActualizado.email,
      licencia: choferActualizado.licencia,
      fecha_vencimiento_licencia: choferActualizado.fecha_vencimiento_licencia?.toISOString().split('T')[0] || null,
      chofer_activo: choferActualizado.activo,
      chofer_estado: choferActualizado.estado,
      chofer_usuario_id: choferActualizado.usuario_id,
      usuario_id: choferActualizado.usuario?.id,
      usuario: choferActualizado.usuario?.usuario,
      usuario_rol_id: choferActualizado.usuario?.rol_id,
      usuario_activo: choferActualizado.usuario?.activo
    };

    return res.status(200).json({ actualizado: true, chofer: dto });
  } catch (e: any) {
    console.error(e);
    if (e?.message) {
      if (e.message === "Chofer no encontrado") return res.status(404).json({ error: e.message });
      return res.status(400).json({ error: e.message });
    }
    return res.status(500).json({ error: "Error al actualizar chofer" });
  }
}

export async function actualizarPasswordChofer(
  req: Request<{ id: string }, {}, { password: string }>,
  res: Response
) {
  const { id } = req.params;
  const { password } = req.body;
  
  console.log('[ACTUALIZAR_PASSWORD] Actualizando password para chofer ID:', id);

  if (!password || password.length < 6) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
  }

  try {
    const chofer = await prisma.chofer.findUnique({
      where: { id: Number(id) }
    });

    if (!chofer || !chofer.usuario_id) {
      return res.status(404).json({ error: "Chofer no encontrado o sin usuario asociado" });
    }
    
    const hash = await hashPassword(password);

    await prisma.usuario.update({
      where: { id: chofer.usuario_id },
      data: { contrasena: hash }
    });
    
    return res.status(200).json({ message: "Contraseña actualizada correctamente" });
  } catch (e) {
    console.error('[ACTUALIZAR_PASSWORD] Error inesperado:', e);
    return res.status(500).json({ error: "Error al actualizar la contraseña" });
  }
}

export async function eliminarChofer(
  req: Request<{ id: string }>,
  res: Response
) {
  const idStr = req.params.id;
  const id = Number(idStr);
  
  try {
    const chofer = await prisma.chofer.findUnique({
      where: { id }
    });

    if (!chofer) {
      return res.status(404).json({ error: "Chofer no encontrado" });
    }

    await prisma.$transaction(async (tx) => {
      await tx.chofer.delete({
        where: { id }
      });
      if (chofer.usuario_id) {
        await tx.usuario.delete({
          where: { id: chofer.usuario_id }
        });
      }
    });

    return res.status(200).json({ eliminado: true });
  } catch (e: any) {
    console.error('Error al eliminar chofer:', e);
    // Prisma Foreign Key Constraint Failed Code is P2003
    if (e.code === 'P2003') {
      return res.status(400).json({ 
        error: 'No se puede eliminar el chofer porque está asignado a uno o más viajes'
      });
    }
    return res.status(500).json({ error: "Error al eliminar chofer" });
  }
}
