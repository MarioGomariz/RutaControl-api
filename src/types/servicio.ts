export interface Servicio {
    id?: number;
    nombre: string;
    descripcion?: string;
    requierePruebaHidraulica: boolean;
    requiereVisuales: boolean;
    requiereValvulaYMangueras: boolean;
    observaciones?: string;
  }
  