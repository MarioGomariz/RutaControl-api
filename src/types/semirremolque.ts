export interface Semirremolque {
    id?: number;
    nombre: string;
    dominio: string;
    anio: number;
    estado: string;
    tipoServicio: string;
    alcanceServicio: string;
    vencimientoRTO: string;
    vencimientoVisualExterna: string;
    vencimientoVisualInterna: string;
    vencimientoEspesores: string;
    vencimientoPruebaHidraulica: string;
    vencimientoMangueras: string;
    vencimientoValvulaFlujo: string;
    observaciones?: string;
  }
  