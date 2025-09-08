// =========================
// Tabla: Tractores
// =========================

export type EstadoUnidad = 'disponible' | 'en uso' | 'en reparacion' | 'fuera de servicio';

export interface Tractor {
  id: number;
  marca: string;
  modelo: string;
  dominio: string;
  anio: number;
  vencimiento_rto?: string;
  estado: EstadoUnidad;
  tipo_servicio?: string;
  alcance_servicio?: 'nacional' | 'internacional';
}