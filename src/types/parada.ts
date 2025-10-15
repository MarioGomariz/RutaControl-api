// =========================
// Tabla: Parada
// =========================
export type TipoParada = 'inicio' | 'descanso' | 'carga' | 'otro' | 'llegada';

export interface Parada {
  id: number;
  viaje_id: number;
  odometro: number;
  ubicacion: string;
  tipo: TipoParada;
  destino_id?: number | null;
  fecha_hora: string; // Date en ISO
}

export interface CreateParadaDTO {
  viaje_id: number;
  odometro: number;
  ubicacion: string;
  tipo: TipoParada;
  destino_id?: number | null;
}
