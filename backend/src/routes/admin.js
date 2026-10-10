import express from 'express';
import { login, requireAdmin } from '../services/admin/auth.js';
import { audit, listAudit } from '../services/admin/audit.js';
import { dashboard } from '../services/admin/dashboard.js';
import * as net from '../services/admin/network-edit.js';
import { getSettings, updateSettings, resetSettings } from '../services/admin/settings.js';
import { listTickets, getTicket, validateTicket, cancelTicket, revenueReport, verifyQr } from '../services/admin/tickets.js';

/** Admin API, mounted by index.js at /api/admin. */
const admin = express();

const int = (v, d) => (Number.isFinite(Number(v)) && v !== '' && v != null ? Math.max(0, Math.floor(Number(v))) : d);
const str = (v) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);

admin.post('/login', (req, res) => {
  res.json(login(req.body?.password));
});

admin.use(requireAdmin);

admin.get('/dashboard', (_req, res) => res.json(dashboard()));

// ---------- stops + platforms ----------

admin.get('/stops', (req, res) => {
  res.json(net.listStops({ mode: str(req.query.mode), q: str(req.query.q), limit: Math.min(int(req.query.limit, 200), 5000), offset: int(req.query.offset, 0) }));
});
admin.get('/stops/:id', (req, res) => res.json(net.getStop(req.params.id)));
admin.post('/stops', (req, res) => {
  const stop = net.createStop(req.body ?? {});
  audit(req, 'create', 'stop', stop.id, { after: stop });
  res.status(201).json(stop);
});
admin.put('/stops/:id', (req, res) => {
  const { before, after } = net.updateStop(req.params.id, req.body ?? {});
  audit(req, 'update', 'stop', after.id, { before, after });
  res.json(after);
});
admin.delete('/stops/:id', (req, res) => {
  const force = ['1', 'true'].includes(String(req.query.force));
  const out = net.deleteStop(req.params.id, force);
  audit(req, 'delete', 'stop', req.params.id, { before: out.stop, force, removedFromLines: out.removedFromLines });
  res.json({ deleted: req.params.id, removedFromLines: out.removedFromLines });
});

admin.get('/stops/:id/platforms', (req, res) => res.json(net.listPlatforms(req.params.id)));
admin.post('/stops/:id/platforms', (req, res) => {
  const p = net.createPlatform(req.params.id, req.body ?? {});
  audit(req, 'create', 'platform', `${req.params.id}/${p.id}`, { after: p });
  res.status(201).json(p);
});
admin.put('/stops/:id/platforms/:pid', (req, res) => {
  const p = net.updatePlatform(req.params.id, req.params.pid, req.body ?? {});
  audit(req, 'update', 'platform', `${req.params.id}/${p.id}`, { after: p });
  res.json(p);
});
admin.delete('/stops/:id/platforms/:pid', (req, res) => {
  const p = net.deletePlatform(req.params.id, req.params.pid);
  audit(req, 'delete', 'platform', `${req.params.id}/${p.id}`, { before: p });
  res.json({ deleted: p.id });
});

// ---------- lines ----------

admin.get('/lines', (req, res) => res.json(net.listLines({ mode: str(req.query.mode), q: str(req.query.q), status: str(req.query.status) })));
admin.get('/lines/:id', (req, res) => res.json(net.getLine(req.params.id)));
admin.post('/lines', (req, res) => {
  const line = net.createLine(req.body ?? {});
  audit(req, 'create', 'line', line.id, { after: line });
  res.status(201).json(line);
});
admin.put('/lines/:id', (req, res) => {
  const { before, after } = net.updateLine(req.params.id, req.body ?? {});
  audit(req, 'update', 'line', after.id, { before, after });
  res.json(after);
});
admin.post('/lines/:id/status', (req, res) => {
  const active = req.body?.active !== false;
  const { before, after } = net.setLineActive(req.params.id, active, str(req.body?.reason));
  audit(req, active ? 'resume' : 'suspend', 'line', after.id, { reason: after.suspendedReason ?? null, wasActive: before.active !== false });
  res.json(after);
});
admin.delete('/lines/:id', (req, res) => {
  const line = net.deleteLine(req.params.id);
  audit(req, 'delete', 'line', line.id, { before: line });
  res.json({ deleted: line.id });
});

// ---------- fares + fare sharing ----------

admin.get('/fares', (_req, res) => res.json(net.getFares()));
admin.put('/fares/:mode', (req, res) => {
  const { before, after } = net.updateFares(req.params.mode, req.body ?? {});
  audit(req, 'update', 'fares', req.params.mode, { before, after });
  res.json(after);
});

admin.get('/settings', (_req, res) => res.json(getSettings()));
admin.put('/settings', (req, res) => {
  const { before, after } = updateSettings(req.body ?? {});
  const pick = ({ integrationDiscount, fareWeight, costWeights }) => ({ integrationDiscount, fareWeight, costWeights });
  audit(req, 'update', 'settings', 'fare-sharing', { before: pick(before), after: pick(after) });
  res.json(after);
});
admin.post('/settings/reset', (req, res) => {
  const after = resetSettings();
  audit(req, 'reset', 'settings', 'fare-sharing', {});
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
admin.post('/tickets/scan', (req, res) => {
  // Validate by QR payload, as a gate / inspector would.
  const id = verifyQr(req.body?.qr);
  const { after } = validateTicket(id, { by: 'qr-scan' });
  audit(req, 'validate', 'ticket', id, { via: 'qr' });
  res.json(after);
});
admin.get('/tickets/:id', (req, res) => res.json(getTicket(req.params.id)));
admin.post('/tickets/:id/validate', (req, res) => {
  const { after } = validateTicket(req.params.id);
  audit(req, 'validate', 'ticket', after.id, {});
  res.json(after);
});
admin.post('/tickets/:id/cancel', (req, res) => {
  const { after } = cancelTicket(req.params.id, { reason: str(req.body?.reason), refundAmount: req.body?.refundAmount });
  audit(req, 'cancel', 'ticket', after.id, { refundAmount: after.refundAmount, reason: after.cancelReason });
  res.json(after);
});

admin.get('/reports/revenue', (req, res) => res.json(revenueReport({ from: str(req.query.from), to: str(req.query.to) })));

// ---------- misc ----------

admin.get('/audit', (req, res) => {
  res.json(listAudit({ entity: str(req.query.entity), action: str(req.query.action), q: str(req.query.q), limit: Math.min(int(req.query.limit, 200), 2000), offset: int(req.query.offset, 0) }));
});

export default admin;
