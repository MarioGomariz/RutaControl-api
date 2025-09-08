import jwt from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";

export type JwtPayload = {
  id: number;
  usuario: string;
  rol_id: number;
  iat?: number;
  exp?: number;
};

export interface AuthRequest extends Request {
  auth?: JwtPayload;
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "No autorizado" });
  }

  const token = header.split(" ")[1];
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;
    req.auth = payload;
    next();
  } catch {
    return res.status(401).json({ error: "Token inválido o expirado" });
  }
}

// Opcional: guard por rol
export function requireRole(...rolesPermitidos: number[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.auth) return res.status(401).json({ error: "No autorizado" });
    if (!rolesPermitidos.includes(req.auth.rol_id)) {
      return res.status(403).json({ error: "No tenés permisos" });
    }
    next();
  };
}

// Mantener compatibilidad con código existente
export function authRequired(req: Request, res: Response, next: NextFunction) {
  return requireAuth(req as AuthRequest, res, next);
}
