import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import authRoutes from './routes/auth.routes.js';
import choferesRoutes from './routes/choferes.routes.js';
import serviciosRoutes from './routes/servicios.routes.js';
import tractoresRoutes from './routes/tractores.routes.js';
import semisRoutes from './routes/semirremolques.routes.js';
import viajesRoutes from './routes/viajes.routes.js';
import usuariosRoutes from './routes/usuarios.routes.js';
import paradasRoutes from './routes/paradas.routes.js';
import estadisticasRoutes from './routes/estadisticas.routes.js';
import { pool } from './db/pool.js';

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
app.use('/api/paradas', paradasRoutes);
app.use('/api/estadisticas', estadisticasRoutes);

// 404
app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

// Error handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = Number(process.env.PORT || 3001);
app.listen(PORT, () => console.log(`API escuchando en http://localhost:${PORT}`));
