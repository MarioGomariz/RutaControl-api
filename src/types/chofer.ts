// =========================
// Tabla: Chofer
// =========================
export interface Chofer {
  id: number;
  nombre: string;
  apellido: string;
  dni: string;
  telefono?: string;
  email: string;
  licencia?: string;
  fecha_vencimiento_licencia: string; 
  activo: boolean;
  estado: 'disponible' | 'en viaje' | 'inactivo';
  usuario_id: number;
}