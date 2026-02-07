// =========================
// Tabla: Roles
// =========================
export interface Role {
    id: number;
    rol: string; // 'admin' | 'chofer' | 'analista' | 'logistico'
}

// Constantes de roles
export const ROLES = {
    ADMIN: 1,
    CHOFER: 2,
    ANALISTA: 3,
    LOGISTICO: 4
} as const;