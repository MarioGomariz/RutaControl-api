export interface Chofer {
    id?: number;
    usuario_id?: number;
    nombre: string;
    apellido: string;
    dni: string;
    telefono: string;
    email: string;
    licencia: string;
    fecha_vencimiento_licencia: string; // formato 'YYYY-MM-DD'
    estado: boolean;
  }
  