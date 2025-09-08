// =========================
// Tabla: Servicios
// =========================
export interface Servicio {
  id: number;
  nombre: string;
  descripcion?: string;
  requiere_prueba_hidraulica: boolean;
  requiere_visuales: boolean;
  requiere_valvula_y_mangueras: boolean;
}