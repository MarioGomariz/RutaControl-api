import 'dotenv/config';
import { createPool } from 'mysql2/promise';

// Usar variables de Railway si existen, sino usar las personalizadas
// Para conexiones externas desde Vercel, usar MYSQL_PUBLIC_URL parseado o DATABASE_HOST
const host = process.env.DATABASE_HOST || 'yamanote.proxy.rlwy.net';
const port = Number(process.env.DATABASE_PORT || 36488);
const user = process.env.DATABASE_USER || process.env.MYSQLUSER || 'root';
const pwd = process.env.DATABASE_PASSWORD || process.env.MYSQLPASSWORD || '';
const database = process.env.DATABASE_NAME || process.env.MYSQL_DATABASE || 'railway';

console.log('[DB] Configuración de conexión:', {
  host,
  port,
  user,
  database,
  hasPassword: !!pwd,
  passwordLength: pwd.length,
  passwordPreview: pwd.length > 0 ? `${pwd.substring(0, 3)}...${pwd.substring(pwd.length - 3)}` : 'EMPTY',
  ssl: host.includes('railway') ? 'enabled' : 'disabled'
});

export const pool = createPool({
  host,
  port,
  user,
  password: pwd,
  database,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  ssl: host.includes('railway') ? {
    rejectUnauthorized: false
  } : undefined
});
