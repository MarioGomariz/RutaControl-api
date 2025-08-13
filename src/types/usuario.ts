export interface Usuario {
    id?: number;
    usuario: string;
    email: string;
    contrasena: string; // hash
    rol_id: number;
    activo: boolean;
    created_at?: string;
  }
  