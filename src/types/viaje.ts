export type Alcance = 'nacional' | 'internacional';
export type EstadoViaje = 'programado' | 'en_curso' | 'finalizado';

export interface Viaje {
  id?: number;
  chofer_id: number;
  tractor_id: number;
  semirremolque_id: number;
  servicio_id: number;

  alcance: Alcance;
  origen: string;
  cantidad_destinos?: number; // lo setea el back
  fecha_hora_salida: string;  // 'YYYY-MM-DD HH:mm:ss'
  estado: EstadoViaje;
  created_at?: string;
}

export interface ViajeDestino {
  id?: number;
  viaje_id?: number;
  orden: number;
  ubicacion: string;
}
