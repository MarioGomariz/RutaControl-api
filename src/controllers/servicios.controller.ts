import { Request, Response } from 'express';
import { prisma } from '../db/prisma.js';

/**
 * Listar servicios
 * Solo hay 2 servicios fijos: Gas Líquido y Combustible Líquido
 * No se permite crear, actualizar o eliminar servicios
 */
export async function listarServicios(_req: Request, res: Response) {
  try {
    const servicios = await prisma.servicio.findMany({
      orderBy: { id: 'asc' }
    });
    res.json(servicios);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al listar servicios' });
  }
}

/**
 * Obtener un servicio por ID
 * Útil para validaciones y referencias
 */
export async function obtenerServicio(req: Request<{ id: string }>, res: Response) {
  try {
    const { id } = req.params;
    const servicio = await prisma.servicio.findUnique({
      where: { id: Number(id) }
    });
    
    if (!servicio) return res.status(404).json({ error: 'Servicio no encontrado' });
    res.json(servicio);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al obtener servicio' });
  }
}
