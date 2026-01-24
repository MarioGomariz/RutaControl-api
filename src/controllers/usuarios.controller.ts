import { Request, Response } from 'express';
import { pool } from '../db/pool.js';
import { hashPassword } from '../utils/password.js';
import { Usuario } from '../types/usuario.js';

/**
 * Listar todos los usuarios
 */
export async function listarUsuarios(_req: Request, res: Response) {
  try {
    const [rows] = await pool.query(
      `SELECT *
       FROM usuario
       ORDER BY id DESC`
    );
    return res.json(rows);
  } catch (error) {
    console.error('Error al listar usuarios:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

/**
 * Obtener un usuario específico por ID
 */
export async function obtenerUsuario(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const [rows] = await pool.query(
      `SELECT *
       FROM usuario
       WHERE id = ? LIMIT 1`,
      [id]
    );
    
    const usuario = (rows as any[])[0];
    if (!usuario) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    
    return res.json(usuario);
  } catch (error) {
    console.error('Error al obtener usuario:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

/**
 * Crear un nuevo usuario
 */
export async function crearUsuario(req: Request, res: Response) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    
    const body = req.body as Usuario;
    
    // Validaciones básicas
    if (!body.usuario || !body.contrasena || !body.rol_id) {
      return res.status(400).json({ error: 'Faltan campos requeridos' });
    }
    
    // Verificar si el usuario ya existe
    const [[dupU]]: any = await conn.query(
      'SELECT id FROM usuario WHERE usuario = ? LIMIT 1', 
      [body.usuario]
    );
    
    if (dupU) {
      return res.status(400).json({ error: 'El nombre de usuario ya está registrado' });
    }
    
    // Hash de la contraseña
    const hash = await hashPassword(body.contrasena);
    
    // Crear el usuario
    const [result] = await conn.query(
      `INSERT INTO usuario (usuario, contrasena, rol_id, activo)
       VALUES (?, ?, ?, ?)`,
      [body.usuario, hash, body.rol_id, body.activo ?? 1]
    );
    
    await conn.commit();
    
    const id = (result as any).insertId;
    return res.status(201).json({ 
      id,
      usuario: body.usuario,
      rol_id: body.rol_id,
      activo: body.activo ?? 1
    });
    
  } catch (error) {
    await conn.rollback();
    console.error('Error al crear usuario:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  } finally {
    conn.release();
  }
}

/**
 * Actualizar un usuario existente
 */
export async function actualizarUsuario(req: Request, res: Response) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    
    const { id } = req.params;
    const body = req.body as Partial<Usuario>;
    
    // Verificar si el usuario existe
    const [[usuario]]: any = await conn.query(
      'SELECT * FROM usuario WHERE id = ? LIMIT 1',
      [id]
    );
    
    if (!usuario) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    
    // Verificar si el nuevo nombre de usuario ya existe (si se está cambiando)
    if (body.usuario && body.usuario !== usuario.usuario) {
      const [[dupU]]: any = await conn.query(
        'SELECT id FROM usuario WHERE usuario = ? AND id != ? LIMIT 1',
        [body.usuario, id]
      );
      
      if (dupU) {
        return res.status(400).json({ error: 'El nombre de usuario ya está registrado' });
      }
    }
    
    // Preparar datos para actualizar
    const updateData: any = {};
    const updateParams: any[] = [];
    
    if (body.usuario) {
      updateData.usuario = body.usuario;
      updateParams.push(body.usuario);
    }
    
    if (body.contrasena) {
      const hash = await hashPassword(body.contrasena);
      updateData.contrasena = hash;
      updateParams.push(hash);
    }
    
    if (body.rol_id !== undefined) {
      updateData.rol_id = body.rol_id;
      updateParams.push(body.rol_id);
    }
    
    if (body.activo !== undefined) {
      updateData.activo = body.activo;
      updateParams.push(body.activo);
    }
    
    // Si no hay datos para actualizar
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: 'No se proporcionaron datos para actualizar' });
    }
    
    // Construir la consulta SQL
    const setClause = Object.keys(updateData).map(key => `${key} = ?`).join(', ');
    updateParams.push(id); // Para el WHERE id = ?
    
    await conn.query(
      `UPDATE usuario SET ${setClause} WHERE id = ?`,
      updateParams
    );
    
    await conn.commit();
    
    // Obtener el usuario actualizado
    const [rows] = await pool.query(
      `SELECT id, usuario, rol_id, activo
       FROM usuario
       WHERE id = ? LIMIT 1`,
      [id]
    );
    
    return res.json((rows as any[])[0]);
    
  } catch (error) {
    await conn.rollback();
    console.error('Error al actualizar usuario:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  } finally {
    conn.release();
  }
}

/**
 * Eliminar un usuario
 */
export async function eliminarUsuario(req: Request, res: Response) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    
    const { id } = req.params;
    
    // Verificar si el usuario existe
    const [[usuario]]: any = await conn.query(
      'SELECT id FROM usuario WHERE id = ? LIMIT 1',
      [id]
    );
    
    if (!usuario) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    
    // Verificar si el usuario está asociado a un chofer
    const [[chofer]]: any = await conn.query(
      'SELECT id FROM chofer WHERE usuario_id = ? LIMIT 1',
      [id]
    );
    
    if (chofer) {
      return res.status(400).json({ 
        error: 'No se puede eliminar el usuario porque está asociado a un chofer' 
      });
    }
    
    // Eliminar el usuario
    await conn.query('DELETE FROM usuario WHERE id = ?', [id]);
    
    await conn.commit();
    
    return res.json({ message: 'Usuario eliminado correctamente' });
    
  } catch (error) {
    await conn.rollback();
    console.error('Error al eliminar usuario:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  } finally {
    conn.release();
  }
}
