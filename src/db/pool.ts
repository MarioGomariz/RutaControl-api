import 'dotenv/config';
import { createPool } from 'mysql2/promise';

// Si existe MYSQL_PUBLIC_URL de Railway, usarla directamente
let poolConfig: any;

if (process.env.MYSQL_PUBLIC_URL) {
  console.log('[DB] Usando MYSQL_PUBLIC_URL de Railway');
  poolConfig = {
    uri: process.env.MYSQL_PUBLIC_URL,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    connectTimeout: 10000,
    ssl: {
      rejectUnauthorized: false
    }
  };
} else {
  // Usar variables individuales
  const host = process.env.DATABASE_HOST || 'yamanote.proxy.rlwy.net';
  const port = Number(process.env.DATABASE_PORT || 36488);
  const user = process.env.DATABASE_USER || process.env.MYSQLUSER || 'root';
  const pwd = process.env.DATABASE_PASSWORD || process.env.MYSQLPASSWORD || '';
  const database = process.env.DATABASE_NAME || process.env.MYSQL_DATABASE || 'railway';

  // Railway usa dominios .railway.internal o .rlwy.net
  const isRailway = host.includes('railway') || host.includes('rlwy.net');

  console.log('[DB] Configuración de conexión:', {
    host,
    port,
    user,
    database,
    hasPassword: !!pwd,
    passwordLength: pwd.length,
    passwordPreview: pwd.length > 0 ? `${pwd.substring(0, 3)}...${pwd.substring(pwd.length - 3)}` : 'EMPTY',
    isRailway,
    ssl: isRailway ? 'enabled' : 'disabled'
  });

  poolConfig = {
    host,
    port,
    user,
    password: pwd,
    database,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    connectTimeout: 10000,
    ssl: isRailway ? {
      rejectUnauthorized: false
    } : undefined
  };
}

export const pool = createPool(poolConfig);
