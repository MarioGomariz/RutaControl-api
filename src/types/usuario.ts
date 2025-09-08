// =========================
// Tabla: Usuario
// =========================
export interface Usuario {
  id: number;
  usuario: string;       // email
  contrasena: string;    // hash
  rol_id: number;        // FK → Role.id
  activo: boolean;
}