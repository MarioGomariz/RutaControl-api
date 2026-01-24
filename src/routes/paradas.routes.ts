import { Router } from "express";
import {
  listarParadasPorViaje,
  crearParada,
  finalizarViaje,
  exportarParadas,
} from "../controllers/paradas.controller.js";

const router = Router();

// GET /api/paradas/viaje/:viaje_id - Listar paradas de un viaje
router.get("/viaje/:viaje_id", listarParadasPorViaje);

// GET /api/paradas/viaje/:viaje_id/export - Exportar información de paradas
router.get("/viaje/:viaje_id/export", exportarParadas);

// POST /api/paradas - Crear una nueva parada
router.post("/", crearParada);

// PUT /api/viajes/:viaje_id/finalizar - Finalizar un viaje
router.put("/viaje/:viaje_id/finalizar", finalizarViaje);

export default router;
