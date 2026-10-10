import { Router } from 'express';
import { issueTicket, getTicket } from '../services/admin/tickets.js';

const router = Router();

/** Issues an integrated ticket: { from, to, optionId? | signature? } (same from/to as /plan). */
router.post('/tickets', (req, res) => {
  res.status(201).json(issueTicket(req.body ?? {}, { channel: req.body?.channel === 'web' ? 'web' : 'app' }));
});

router.get('/tickets/:id', (req, res) => {
  res.json(getTicket(req.params.id));
});

export default router;
