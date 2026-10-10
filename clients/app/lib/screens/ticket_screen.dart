import 'dart:async';

import 'package:flutter/material.dart';

import '../api.dart';
import '../models.dart';
import '../store.dart';
import '../theme.dart';
import '../widgets/fare_breakdown.dart';
import '../widgets/mode_chip.dart';
import '../widgets/state_views.dart';
import '../widgets/ticket_code.dart';

const _statusLabels = {'active': 'Active', 'used': 'Used', 'cancelled': 'Cancelled', 'expired': 'Expired'};

/// Colours and label for a ticket status.
({String label, Color bg, Color fg, IconData icon}) ticketStatusStyle(BuildContext context, String status) {
  final scheme = Theme.of(context).colorScheme;
  final label = _statusLabels[status] ?? status;
  return switch (status) {
    'active' => (label: label, bg: scheme.primary, fg: scheme.onPrimary, icon: Icons.check_circle),
    'cancelled' => (label: label, bg: scheme.errorContainer, fg: scheme.onErrorContainer, icon: Icons.cancel_outlined),
    _ => (label: label, bg: scheme.surfaceContainerHighest, fg: scheme.onSurfaceVariant, icon: Icons.history),
  };
}

String _countdown(Duration d) {
  final h = d.inHours;
  final m = d.inMinutes % 60;
  final s = d.inSeconds % 60;
  return h > 0 ? '$h:${twoDigits(m)}:${twoDigits(s)}' : '${twoDigits(m)}:${twoDigits(s)}';
}

class TicketScreen extends StatefulWidget {
  final Ticket ticket;
  final bool justBooked;
  final bool routeChanged;
  const TicketScreen({super.key, required this.ticket, this.justBooked = false, this.routeChanged = false});

  @override
  State<TicketScreen> createState() => _TicketScreenState();
}

class _TicketScreenState extends State<TicketScreen> {
  late Ticket _ticket = widget.ticket;
  late final Timer _clock;
  DateTime _now = DateTime.now();
  DateTime? _checkedAt;
  bool _refreshing = false;
  String? _refreshError;

  @override
  void initState() {
    super.initState();
    _clock = Timer.periodic(const Duration(seconds: 1), (_) => setState(() => _now = DateTime.now()));
    if (widget.justBooked) {
      _checkedAt = DateTime.now();
    } else {
      _refresh();
    }
  }

  @override
  void dispose() {
    _clock.cancel();
    super.dispose();
  }

  Future<void> _refresh() async {
    setState(() {
      _refreshing = true;
      _refreshError = null;
    });
    try {
      final t = await Api.instance.ticket(_ticket.id);
      AppStore.instance.tickets.update(t);
      if (!mounted) return;
      setState(() {
        _ticket = t;
        _checkedAt = DateTime.now();
      });
    } catch (e) {
      if (mounted) setState(() => _refreshError = e is ApiException ? e.message : 'Couldn\'t check the ticket status.');
    } finally {
      if (mounted) setState(() => _refreshing = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = _ticket;
    final scheme = Theme.of(context).colorScheme;
    final text = Theme.of(context).textTheme;
    final status = t.statusAt(_now);
    final st = ticketStatusStyle(context, status);
    final left = t.validUntil?.difference(_now);
    final usable = status == 'active';
    return Scaffold(
      appBar: AppBar(
        title: const Text('Ticket'),
        actions: [
          _refreshing
              ? const Padding(
                  padding: EdgeInsets.all(Space.m),
                  child: SizedBox(width: 24, height: 24, child: CircularProgressIndicator(strokeWidth: 2.5)),
                )
              : IconButton(tooltip: 'Refresh ticket status', icon: const Icon(Icons.refresh), onPressed: _refresh),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _refresh,
        child: ListView(padding: const EdgeInsets.all(Space.l), children: [
          if (widget.justBooked)
            Semantics(
              liveRegion: true,
              child: _Banner(
                icon: Icons.check_circle,
                color: successColor(context),
                title: 'Ticket booked',
                message: 'Pay ${rupees(t.fare)} at the counter. In-app payment is coming soon.',
              ),
            ),
          if (widget.routeChanged)
            _Banner(
              icon: Icons.info_outline,
              color: warningColor(context),
              title: 'Route updated',
              message: 'Timetables changed since you planned. This ticket covers the route shown below.',
            ),
          if (_refreshError != null)
            _Banner(icon: Icons.cloud_off, color: scheme.error, title: 'Status not updated', message: _refreshError!),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(Space.l),
              child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                Wrap(
                  alignment: WrapAlignment.spaceBetween,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  spacing: Space.s,
                  runSpacing: Space.s,
                  children: [
                    Semantics(
                      label: 'Status: ${st.label}',
                      excludeSemantics: true,
                      child: Pill(text: st.label, icon: st.icon, background: st.bg, foreground: st.fg),
                    ),
                    if (left != null)
                      Text(
                        usable ? 'Valid for ${_countdown(left)}' : 'Valid until ${clockOf(t.validUntil!)}',
                        style: text.titleSmall?.copyWith(
                          fontWeight: FontWeight.w700,
                          fontFeatures: const [FontFeature.tabularFigures()],
                          color: usable && left.inMinutes < 15 ? warningColor(context) : null,
                        ),
                      ),
                  ],
                ),
                if (usable && t.validUntil != null)
                  Padding(
                    padding: const EdgeInsets.only(top: Space.xs),
                    child: Text('Until ${clockOf(t.validUntil!)} today', style: text.bodySmall?.copyWith(color: scheme.onSurfaceVariant)),
                  ),
                const SizedBox(height: Space.l),
                TicketCode(ticketId: t.id, payload: t.qr, dimmed: !usable),
                if (_checkedAt != null)
                  Padding(
                    padding: const EdgeInsets.only(top: Space.s),
                    child: Text(
                      'Status checked at ${clockOf(_checkedAt!)}',
                      textAlign: TextAlign.center,
                      style: text.bodySmall?.copyWith(color: scheme.onSurfaceVariant),
                    ),
                  ),
              ]),
            ),
          ),
          const SizedBox(height: Space.l),
          const SectionHeader('Route'),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(Space.l),
              child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                _Endpoint(icon: Icons.trip_origin, color: startColor, label: t.from.label),
                ...t.legs.map((l) => _TicketLegRow(leg: l)),
                _Endpoint(icon: Icons.place, color: endColor, label: t.to.label),
                if (t.totalMin > 0) ...[
                  const SizedBox(height: Space.s),
                  Text('${formatMin(t.totalMin)} · ${changesLabel(t.transfers)}',
                      style: text.bodySmall?.copyWith(color: scheme.onSurfaceVariant)),
                ],
              ]),
            ),
          ),
          const SizedBox(height: Space.l),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(Space.l),
              child: FareBreakdown(fare: t.fare, standaloneFare: t.standaloneFare, savings: t.savings, shares: t.split),
            ),
          ),
          if (t.createdAt != null)
            Padding(
              padding: const EdgeInsets.only(top: Space.l),
              child: Text(
                'Booked at ${clockOf(t.createdAt!)} on ${t.createdAt!.day}/${t.createdAt!.month}/${t.createdAt!.year}',
                textAlign: TextAlign.center,
                style: text.bodySmall?.copyWith(color: scheme.onSurfaceVariant),
              ),
            ),
        ]),
      ),
    );
  }
}

class _Banner extends StatelessWidget {
  final IconData icon;
  final Color color;
  final String title;
  final String message;
  const _Banner({required this.icon, required this.color, required this.title, required this.message});

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    return Padding(
      padding: const EdgeInsets.only(bottom: Space.m),
      child: Container(
        padding: const EdgeInsets.all(Space.m),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.12),
          borderRadius: BorderRadius.circular(Radii.m),
          border: Border.all(color: color.withValues(alpha: 0.5)),
        ),
        child: MergeSemantics(
          child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Icon(icon, color: color),
            const SizedBox(width: Space.m),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(title, style: text.titleSmall?.copyWith(fontWeight: FontWeight.w700)),
                Text(message, style: text.bodyMedium),
              ]),
            ),
          ]),
        ),
      ),
    );
  }
}

class _Endpoint extends StatelessWidget {
  final IconData icon;
  final Color color;
  final String label;
  const _Endpoint({required this.icon, required this.color, required this.label});

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(vertical: Space.xs),
        child: Row(children: [
          Icon(icon, color: color, size: 20),
          const SizedBox(width: Space.m),
          Expanded(child: Text(label, style: Theme.of(context).textTheme.titleMedium)),
        ]),
      );
}

class _TicketLegRow extends StatelessWidget {
  final TicketLeg leg;
  const _TicketLegRow({required this.leg});

  @override
  Widget build(BuildContext context) {
    final l = leg;
    final text = Theme.of(context).textTheme;
    final c = Theme.of(context).colorScheme.primary;
    final times = [l.departTime, l.arriveTime].whereType<String>().join('–');
    return IntrinsicHeight(
      child: Row(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        SizedBox(
          width: 20,
          child: Center(
            child: Container(width: 4, decoration: BoxDecoration(color: c, borderRadius: BorderRadius.circular(2))),
          ),
        ),
        const SizedBox(width: Space.m),
        Expanded(
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: Space.s),
            child: MergeSemantics(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Wrap(spacing: Space.s, crossAxisAlignment: WrapCrossAlignment.center, children: [
                  ModeChip(mode: l.mode, line: l.line, dense: true),
                  if (times.isNotEmpty) Text(times, style: text.bodySmall?.copyWith(fontWeight: FontWeight.w700)),
                ]),
                const SizedBox(height: Space.xs),
                Text('${l.from} → ${l.to}', style: text.bodyMedium),
                Text('${plural(l.stops, 'stop')} · ${l.distanceKm.toStringAsFixed(1)} km',
                    style: text.bodySmall?.copyWith(color: Theme.of(context).colorScheme.onSurfaceVariant)),
              ]),
            ),
          ),
        ),
      ]),
    );
  }
}
