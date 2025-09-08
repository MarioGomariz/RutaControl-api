import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import authRoutes from './routes/auth.routes';
import choferesRoutes from './routes/choferes.routes';
import serviciosRoutes from './routes/servicios.routes';
import tractoresRoutes from './routes/tractores.routes';
import semisRoutes from './routes/semirremolques.routes';
import viajesRoutes from './routes/viajes.routes';
import usuariosRoutes from './routes/usuarios.routes';
import { pool } from './db/pool';

const app = express();

app.use(helmet());
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

// Healthcheck + chequeo de DB
app.get('/health', async (_req, res) => {
  try {
    const [rows] = await pool.query('SELECT 1 AS ok');
    return res.json({ ok: true, db: (rows as any[])[0] });
  } catch (e) {
    return res.status(500).json({ ok: false, error: 'DB fail' });
  }
});

// Rutas
app.use('/api/auth', authRoutes);
app.use('/api/choferes', choferesRoutes);
app.use('/api/servicios', serviciosRoutes);
app.use('/api/tractores', tractoresRoutes);
app.use('/api/semirremolques', semisRoutes);
app.use('/api/viajes', viajesRoutes);
app.use('/api/usuarios', usuariosRoutes);

// 404
app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

// Error handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = Number(process.env.PORT || 3001);
app.listen(PORT, () => console.log(`API escuchando en http://localhost:${PORT}`));
