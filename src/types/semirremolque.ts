// =========================
// Tabla: Semirremolque
// =========================
export type EstadoUnidad = 'disponible' | 'en uso' | 'en reparacion' | 'fuera de servicio';

export interface Semirremolque {
  id: number;
  nombre: string;
  dominio: string;
  anio: number;
  estado: EstadoUnidad;
  tipo_servicio?: string;
  alcance_servicio?: 'nacional' | 'internacional';
  vencimiento_rto?: string;
  vencimiento_visual_externa?: string;
  vencimiento_visual_interna?: string;
  vencimiento_espesores?: string;
  vencimiento_prueba_hidraulica?: string;
  vencimiento_mangueras?: string;
  vencimiento_valvula_flujo?: string;
}