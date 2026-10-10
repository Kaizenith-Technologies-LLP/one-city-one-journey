import express from 'express';
import cors from 'cors';
import { applySettings } from './config.js';
import { initState, getState } from './state.js';
import { initStorage, networkDocs, readStorage } from './services/admin/store.js';
import networkRoutes from './routes/network.js';
import overlapRoutes from './routes/overlaps.js';
import planRoutes from './routes/plan.js';
import adminRoutes from './routes/admin.js';
import ticketRoutes from './routes/tickets.js';

const PORT = Number(process.env.PORT) || 4000;

await initStorage();
applySettings(readStorage('settings.json', {}));

const { state, loadError } = initState(networkDocs());
if (state) {
  const { network, hubs, overlaps } = state;
  console.log(`Loaded ${network.stops.size} stops, ${network.lines.size} lines, ${hubs.length} hubs, ${overlaps.length} corridor overlaps`);
  for (const l of network.unroutable) console.warn(`Line ${l.id} not routable, missing: ${l.missing.join(', ')}`);
} else {
  console.warn(`Data not loaded (${loadError.message}). API will return 503 until data is fixed.`);
}

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/health', (_req, res) => {
  let dataLoaded = true;
  try {
    getState();
  } catch {
    dataLoaded = false;
  }
  res.json({ ok: true, dataLoaded, database: 'postgres' });
});
app.use('/api', networkRoutes);
app.use('/api', overlapRoutes);
app.use('/api', planRoutes);
app.use('/api', ticketRoutes);
app.use('/api/admin', adminRoutes);

app.use((_req, res) => res.status(404).json({ error: 'Not found' }));
app.use((err, _req, res, _next) => {
  const status = err.status ?? 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: err.message });
});

app.listen(PORT, '0.0.0.0', () => console.log(`One Journey API on http://localhost:${PORT}`));
