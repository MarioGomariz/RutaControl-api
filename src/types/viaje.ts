// =========================
// Tabla: Viaje
// =========================
export type EstadoViaje = 'programado' | 'en curso' | 'finalizado';

export interface Viaje {
  id: number;
  chofer_id: number;         // FK → Chofer.id
  tractor_id: number;        // FK → Tractor.id
  semirremolque_id: number;  // FK → Semirremolque.id
  servicio_id: number;       // FK → Servicio.id
  alcance: 'nacional' | 'internacional';
  origen: string;
  cantidad_destinos: number;
  fecha_hora_salida: string; // Date en ISO
  estado: EstadoViaje;
}

export interface ViajeDestino {
  id: number;
  viaje_id: number;          // FK → Viaje.id
  orden: number;
  ubicacion: string;
}