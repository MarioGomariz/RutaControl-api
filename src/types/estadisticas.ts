// =========================
// Tipos para Estadísticas
// =========================

export interface FiltrosEstadisticas {
  chofer_id?: number;
  tractor_id?: number;
  semirremolque_id?: number;
  servicio_id?: number;
  fecha_inicio?: string;
  fecha_fin?: string;
  alcance?: 'nacional' | 'internacional';
}

export interface KilometrosPorUnidad {
  tractor_id: number;
  tractor_marca: string;
  tractor_modelo: string;
  tractor_dominio: string;
  total_km: number;
  cantidad_viajes: number;
}

export interface ViajesPorChofer {
  chofer_id: number;
  chofer_nombre: string;
  chofer_apellido: string;
  total_viajes: number;
  viajes_finalizados: number;
  viajes_en_curso: number;
  total_km: number;
}

export interface InactividadVehiculo {
  tractor_id: number;
  tractor_marca: string;
  tractor_modelo: string;
  tractor_dominio: string;
  ultimo_viaje: string | null;
  dias_inactivo: number;
  estado: string;
}

export interface ViajesPorMes {
  mes: string;
  anio: number;
  total_viajes: number;
  viajes_finalizados: number;
  total_km: number;
}

export interface ViajesPorServicio {
  servicio_id: number;
  servicio_nombre: string;
  total_viajes: number;
  viajes_finalizados: number;
}

export interface EstadisticasGenerales {
  total_viajes: number;
  viajes_programados: number;
  viajes_en_curso: number;
  viajes_finalizados: number;
  total_km_recorridos: number;
  promedio_km_por_viaje: number;
  total_choferes_activos: number;
  total_tractores_disponibles: number;
}

export interface RespuestaEstadisticas {
  generales: EstadisticasGenerales;
  kilometros_por_unidad: KilometrosPorUnidad[];
  viajes_por_chofer: ViajesPorChofer[];
  inactividad_vehiculos: InactividadVehiculo[];
  viajes_por_mes: ViajesPorMes[];
  viajes_por_servicio: ViajesPorServicio[];
}
