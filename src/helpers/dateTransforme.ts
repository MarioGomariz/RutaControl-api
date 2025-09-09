export const toSqlDate = (val?: string | Date | null) => {
    if (!val) return null;
    const d = typeof val === 'string' ? new Date(val) : val;
    if (Number.isNaN(d.getTime())) throw new Error('Fecha inválida');
    // devuelve 'YYYY-MM-DD'
    return d.toISOString().slice(0, 10);
};