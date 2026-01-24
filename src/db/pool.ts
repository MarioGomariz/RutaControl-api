import 'dotenv/config';
import { createPool } from 'mysql2/promise';

console.log('[DB] Configuración de conexión:', {
  host: process.env.DATABASE_HOST,
  port: process.env.DATABASE_PORT,
  user: process.env.DATABASE_USER,
  database: process.env.DATABASE_NAME,
  hasPassword: !!process.env.DATABASE_PASSWORD,
  passwordLength: process.env.DATABASE_PASSWORD?.length,
  ssl: process.env.DATABASE_HOST?.includes('railway') ? 'enabled' : 'disabled'
});

export const pool = createPool({
  host: process.env.DATABASE_HOST,
  port: Number(process.env.DATABASE_PORT || 3306),
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  ssl: process.env.DATABASE_HOST?.includes('railway') ? {
    rejectUnauthorized: false
  } : undefined
});
