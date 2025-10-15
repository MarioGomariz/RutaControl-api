export const toSqlDate = (val?: string | Date | null) => {
    if (!val) return null;
    const d = typeof val === 'string' ? new Date(val) : val;
    if (Number.isNaN(d.getTime())) throw new Error('Fecha inválida');
    // devuelve 'YYYY-MM-DD'
    return d.toISOString().slice(0, 10);
};

export const toSqlDateTime = (val?: string | Date | null) => {
    if (!val) return null;
    const d = typeof val === 'string' ? new Date(val) : val;
    if (Number.isNaN(d.getTime())) throw new Error('Fecha inválida');
    // devuelve 'YYYY-MM-DD HH:MM:SS' formato MySQL DATETIME
    return d.toISOString().slice(0, 19).replace('T', ' ');
};