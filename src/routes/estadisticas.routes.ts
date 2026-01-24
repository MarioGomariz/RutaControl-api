import { Router } from "express";
import { obtenerEstadisticas, obtenerViajesDetalladosPorChofer } from "../controllers/estadisticas.controller.js";

const router = Router();

// GET /api/estadisticas - Obtener estadísticas con filtros opcionales
router.get("/", obtenerEstadisticas);

// GET /api/estadisticas/chofer/:chofer_id/viajes-detallados - Obtener viajes detallados por chofer
router.get("/chofer/:chofer_id/viajes-detallados", obtenerViajesDetalladosPorChofer);

export default router;
