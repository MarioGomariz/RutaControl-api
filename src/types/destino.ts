// =========================
// Tabla: Destinos
// =========================
export interface Destino {
    id: number;
    ubicacion: string;
    viaje_id: number;          // FK → Viaje.id
    orden: number;
}