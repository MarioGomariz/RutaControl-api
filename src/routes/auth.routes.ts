import { Router, Response } from "express";
import type { AuthRequest } from "../middlewares/auth.middleware.js";
import { requireAuth } from "../middlewares/auth.middleware.js";
import { pool } from "../db/pool.js";
import jwt from "jsonwebtoken";
import type { Request } from "express";
import { comparePassword } from "../utils/password.js";
import { createAdmin } from "../controllers/auth.controller.js";

type LoginBody = { usuario: string; password: string };

const router = Router();

// Login endpoint
router.post("/login", async (req: Request<{}, {}, LoginBody>, res: Response) => {
  try {
    const { usuario, password } = req.body;
    if (!usuario || !password) {
      return res.status(400).json({ error: "Usuario y password requeridos" });
    }

    const [rows] = await pool.query(
      `SELECT *
       FROM usuario
       WHERE usuario = ? LIMIT 1`,
      [usuario]
    );
    const user = (rows as any[])?.[0];
    if (!user) return res.status(400).json({ error: "Credenciales inválidas" });
    if (!user.activo) return res.status(403).json({ error: "Usuario inactivo" });

    const ok = await comparePassword(password, user.contrasena);
    if (!ok) return res.status(400).json({ error: "Credenciales inválidas" });
    const token = jwt.sign(
      { id: user.id, usuario: user.usuario, rol_id: user.rol_id },
      process.env.JWT_SECRET!,
      { expiresIn: "7d" }
    );
    return res.json({ token });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Error al iniciar sesión" });
  }
});

// Nuevo: /auth/me (fuente de verdad del usuario logueado)
router.get("/me", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.auth!.id;

    const [rows] = await pool.query(
      `SELECT 
         id,
         usuario,
         rol_id
       FROM usuario 
       WHERE id = ? LIMIT 1`,
      [userId]
    );
    const u = (rows as any[])?.[0];
    if (!u) return res.status(404).json({ error: "Usuario no encontrado" });

    if(u.rol_id == 2){
      const [rows] = await pool.query(
        `SELECT *
         FROM chofer
         WHERE email = ? LIMIT 1`,
        [u.usuario]
      );
      const chofer = (rows as any[])?.[0];
      if (!chofer) return res.status(404).json({ error: "Chofer no encontrado" });
      return res.json({
        id: chofer.id,
        usuario: u.usuario,
        rol_id: u.rol_id,
        usuario_id: u.id,
      });
    }
    
    // No devolver campos sensibles
    return res.json({
      id: u.id,
      usuario: u.usuario,
      rol_id: u.rol_id,
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "No se pudo obtener el usuario" });
  }
});

// Mantener el endpoint de creación de admin
router.post('/admin', createAdmin); // opcional, para bootstrap

export default router;
