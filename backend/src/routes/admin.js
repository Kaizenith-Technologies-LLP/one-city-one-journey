import express from 'express';
import { login, requireAdmin } from '../services/admin/auth.js';
import { audit, listAudit } from '../services/admin/audit.js';
import { dashboard } from '../services/admin/dashboard.js';
import * as net from '../services/admin/network-edit.js';
import { getSettings, updateSettings, resetSettings } from '../services/admin/settings.js';
import { listTickets, getTicket, validateTicket, cancelTicket, revenueReport, verifyQr } from '../services/admin/tickets.js';
import { listClosures, createClosure, updateClosure, deleteClosure, advisory } from '../services/closures.js';
import { morningBrief } from '../services/admin/brief.js';

/** Admin API, mounted by index.js at /api/admin. */
const admin = express();

const int = (v, d) => (Number.isFinite(Number(v)) && v !== '' && v != null ? Math.max(0, Math.floor(Number(v))) : d);
const str = (v) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);

admin.post('/login', async (req, res) => {
  res.json(login(req.body?.password));
});

admin.use(requireAdmin);

admin.get('/dashboard', (_req, res) => res.json(dashboard()));

// ---------- stops + platforms ----------

admin.get('/stops', (req, res) => {
  res.json(net.listStops({ mode: str(req.query.mode), q: str(req.query.q), limit: Math.min(int(req.query.limit, 200), 5000), offset: int(req.query.offset, 0) }));
});
admin.get('/stops/:id', (req, res) => res.json(net.getStop(req.params.id)));
admin.post('/stops', async (req, res) => {
  const stop = await net.createStop(req.body ?? {});
  await audit(req, 'create', 'stop', stop.id, { after: stop });
  res.status(201).json(stop);
});
admin.put('/stops/:id', async (req, res) => {
  const { before, after } = await net.updateStop(req.params.id, req.body ?? {});
  await audit(req, 'update', 'stop', after.id, { before, after });
  res.json(after);
});
admin.delete('/stops/:id', async (req, res) => {
  const force = ['1', 'true'].includes(String(req.query.force));
  const out = await net.deleteStop(req.params.id, force);
  await audit(req, 'delete', 'stop', req.params.id, { before: out.stop, force, removedFromLines: out.removedFromLines });
  res.json({ deleted: req.params.id, removedFromLines: out.removedFromLines });
});

admin.get('/stops/:id/platforms', (req, res) => res.json(net.listPlatforms(req.params.id)));
admin.post('/stops/:id/platforms', async (req, res) => {
  const p = await net.createPlatform(req.params.id, req.body ?? {});
  await audit(req, 'create', 'platform', `${req.params.id}/${p.id}`, { after: p });
  res.status(201).json(p);
});
admin.put('/stops/:id/platforms/:pid', async (req, res) => {
  const p = await net.updatePlatform(req.params.id, req.params.pid, req.body ?? {});
  await audit(req, 'update', 'platform', `${req.params.id}/${p.id}`, { after: p });
  res.json(p);
});
admin.delete('/stops/:id/platforms/:pid', async (req, res) => {
  const p = await net.deletePlatform(req.params.id, req.params.pid);
  await audit(req, 'delete', 'platform', `${req.params.id}/${p.id}`, { before: p });
  res.json({ deleted: p.id });
});

// ---------- lines ----------

admin.get('/lines', (req, res) => res.json(net.listLines({ mode: str(req.query.mode), q: str(req.query.q), status: str(req.query.status) })));
admin.get('/lines/:id', (req, res) => res.json(net.getLine(req.params.id)));
admin.post('/lines', async (req, res) => {
  const line = await net.createLine(req.body ?? {});
  await audit(req, 'create', 'line', line.id, { after: line });
  res.status(201).json(line);
});
admin.put('/lines/:id', async (req, res) => {
  const { before, after } = await net.updateLine(req.params.id, req.body ?? {});
  await audit(req, 'update', 'line', after.id, { before, after });
  res.json(after);
});
admin.post('/lines/:id/status', async (req, res) => {
  const active = req.body?.active !== false;
  const { before, after } = await net.setLineActive(req.params.id, active, str(req.body?.reason));
  await audit(req, active ? 'resume' : 'suspend', 'line', after.id, { reason: after.suspendedReason ?? null, wasActive: before.active !== false });
  res.json(after);
});
admin.delete('/lines/:id', async (req, res) => {
  const line = await net.deleteLine(req.params.id);
  await audit(req, 'delete', 'line', line.id, { before: line });
  res.json({ deleted: line.id });
});

// ---------- fares + fare sharing ----------

admin.get('/fares', (_req, res) => res.json(net.getFares()));
admin.put('/fares/:mode', async (req, res) => {
  const { before, after } = await net.updateFares(req.params.mode, req.body ?? {});
  await audit(req, 'update', 'fares', req.params.mode, { before, after });
  res.json(after);
});

admin.get('/settings', (_req, res) => res.json(getSettings()));
admin.put('/settings', async (req, res) => {
  const { before, after } = await updateSettings(req.body ?? {});
  const pick = ({ integrationDiscount, fareWeight, costWeights }) => ({ integrationDiscount, fareWeight, costWeights });
  await audit(req, 'update', 'settings', 'fare-sharing', { before: pick(before), after: pick(after) });
  res.json(after);
});
admin.post('/settings/reset', async (req, res) => {
  const after = await resetSettings();
  await audit(req, 'reset', 'settings', 'fare-sharing', {});
  res.json(after);
});

// ---------- tickets + reports ----------

admin.get('/tickets', (req, res) => {
  res.json(
    listTickets({
      status: str(req.query.status),
      operator: str(req.query.operator),
      mode: str(req.query.mode),
      date: str(req.query.date),
      from: str(req.query.from),
      to: str(req.query.to),
      q: str(req.query.q),
      limit: Math.min(int(req.query.limit, 100), 1000),
      offset: int(req.query.offset, 0),
    }),
  );
});
admin.post('/tickets/scan', async (req, res) => {
  // Validate by QR payload, as a gate / inspector would.
  const id = verifyQr(req.body?.qr);
  const { after } = await validateTicket(id, { by: 'qr-scan' });
  await audit(req, 'validate', 'ticket', id, { via: 'qr' });
  res.json(after);
});
admin.get('/tickets/:id', (req, res) => res.json(getTicket(req.params.id)));
admin.post('/tickets/:id/validate', async (req, res) => {
  const { after } = await validateTicket(req.params.id);
  await audit(req, 'validate', 'ticket', after.id, {});
  res.json(after);
});
admin.post('/tickets/:id/cancel', async (req, res) => {
  const { after } = await cancelTicket(req.params.id, { reason: str(req.body?.reason), refundAmount: req.body?.refundAmount });
  await audit(req, 'cancel', 'ticket', after.id, { refundAmount: after.refundAmount, reason: after.cancelReason });
  res.json(after);
});

admin.get('/reports/revenue', (req, res) => res.json(revenueReport({ from: str(req.query.from), to: str(req.query.to) })));

// ---------- closures (diversions) + morning brief ----------

admin.get('/closures', (req, res) => res.json(listClosures({ status: str(req.query.status) }).map((c) => ({ ...c, advisory: advisory(c) }))));
admin.post('/closures', async (req, res) => {
  const c = await createClosure(req.body ?? {});
  await audit(req, 'create', 'closure', c.id, { after: c });
  res.status(201).json({ ...c, advisory: advisory(c) });
});
admin.put('/closures/:id', async (req, res) => {
  const { before, after } = await updateClosure(req.params.id, req.body ?? {});
  await audit(req, 'update', 'closure', after.id, { before, after });
  res.json({ ...after, advisory: advisory(after) });
});
admin.delete('/closures/:id', async (req, res) => {
  const c = await deleteClosure(req.params.id);
  await audit(req, 'delete', 'closure', c.id, { before: c });
  res.json({ deleted: c.id });
});

admin.get('/brief', async (req, res) => {
  const date = str(req.query.date);
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: 'date must be YYYY-MM-DD' });
  res.json(await morningBrief(date));
});

// ---------- misc ----------

admin.get('/audit', (req, res) => {
  res.json(listAudit({ entity: str(req.query.entity), action: str(req.query.action), q: str(req.query.q), limit: Math.min(int(req.query.limit, 200), 2000), offset: int(req.query.offset, 0) }));
});

export default admin;
