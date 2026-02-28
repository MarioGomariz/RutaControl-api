import { Request, Response } from 'express';
import { prisma } from '../db/prisma.js';
import { hashPassword } from '../utils/password.js';
import { Usuario } from '../types/usuario.js';

export async function listarUsuarios(_req: Request, res: Response) {
  try {
    const usuarios = await prisma.usuario.findMany({
      where: {
        rol_id: { not: 2 }
      },
      orderBy: { id: 'desc' }
    });
    return res.json(usuarios);
  } catch (error) {
    console.error('Error al listar usuarios:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

export async function obtenerUsuario(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const usuario = await prisma.usuario.findUnique({
      where: { id: Number(id) }
    });
    
    if (!usuario) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    
    return res.json(usuario);
  } catch (error) {
    console.error('Error al obtener usuario:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

export async function crearUsuario(req: Request, res: Response) {
  try {
    const body = req.body as Usuario;
    
    // Validaciones básicas
    if (!body.usuario || !body.contrasena || !body.rol_id) {
      return res.status(400).json({ error: 'Faltan campos requeridos' });
    }
    
    // Hash de la contraseña
    const hash = await hashPassword(body.contrasena);
    
    try {
      const nuevoUsuario = await prisma.usuario.create({
        data: {
          usuario: body.usuario,
          contrasena: hash,
          rol_id: Number(body.rol_id),
          activo: body.activo ?? true
        }
      });
      
      return res.status(201).json({ 
        id: nuevoUsuario.id,
        usuario: nuevoUsuario.usuario,
        rol_id: nuevoUsuario.rol_id,
        activo: nuevoUsuario.activo
      });
    } catch (e: any) {
      if (e.code === 'P2002') {
        return res.status(400).json({ error: 'El nombre de usuario ya está registrado' });
      }
      throw e;
    }
  } catch (error) {
    console.error('Error al crear usuario:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

export async function actualizarUsuario(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    const body = req.body as Partial<Usuario>;
    
    // Verificar si el usuario existe
    const usuario = await prisma.usuario.findUnique({
      where: { id }
    });
    
    if (!usuario) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    
    // Preparar datos para actualizar
    const dataToUpdate: any = {};
    
    if (body.usuario && body.usuario !== usuario.usuario) {
      // Verificar si el nuevo nombre de usuario ya existe
      const dup = await prisma.usuario.findUnique({ where: { usuario: body.usuario } });
      if (dup) {
        return res.status(400).json({ error: 'El nombre de usuario ya está registrado' });
      }
      dataToUpdate.usuario = body.usuario;
    }
    
    if (body.contrasena) {
      dataToUpdate.contrasena = await hashPassword(body.contrasena);
    }
    
    if (body.rol_id !== undefined) {
      dataToUpdate.rol_id = Number(body.rol_id);
    }
    
    if (body.activo !== undefined) {
      dataToUpdate.activo = Boolean(body.activo);
    }
    
    if (Object.keys(dataToUpdate).length === 0) {
      return res.status(400).json({ error: 'No se proporcionaron datos para actualizar' });
    }
    
    const usuarioUpdated = await prisma.usuario.update({
      where: { id },
      data: dataToUpdate,
      select: {
        id: true,
        usuario: true,
        rol_id: true,
        activo: true
      }
    });
    
    return res.json(usuarioUpdated);
  } catch (error) {
    console.error('Error al actualizar usuario:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

export async function buscarUsuarios(req: Request, res: Response) {
  try {
    const { query } = req.query;
    
    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Se requiere un parámetro de búsqueda' });
    }
    
    const usuarios = await prisma.usuario.findMany({
      where: {
        usuario: {
          contains: query
        }
      },
      orderBy: { usuario: 'asc' },
      select: {
        id: true,
        usuario: true,
        rol_id: true,
        activo: true
      }
    });
    
    return res.json(usuarios);
  } catch (error) {
    console.error('Error al buscar usuarios:', error);
    return res.status(500).json({ 
      error: 'Error interno del servidor al buscar usuarios',
      details: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
}

export async function eliminarUsuario(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    
    // Verificar si el usuario existe y obtener sus choferes asociados
    const usuario = await prisma.usuario.findUnique({
      where: { id },
      include: {
        choferes: {
          select: { id: true }
        }
      }
    });
    
    if (!usuario) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    
    if (usuario.choferes && usuario.choferes.length > 0) {
      return res.status(400).json({ 
        error: 'No se puede eliminar el usuario porque está asociado a un chofer' 
      });
    }
    
    await prisma.usuario.delete({
      where: { id }
    });
    
    return res.json({ message: 'Usuario eliminado correctamente' });
  } catch (error) {
    console.error('Error al eliminar usuario:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}
