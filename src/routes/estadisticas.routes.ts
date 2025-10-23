import { Router } from "express";
import { obtenerEstadisticas } from "../controllers/estadisticas.controller";

const router = Router();

// GET /api/estadisticas - Obtener estadísticas con filtros opcionales
router.get("/", obtenerEstadisticas);

export default router;
