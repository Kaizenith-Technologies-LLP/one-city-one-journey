import 'package:flutter/material.dart';

import '../api.dart';
import '../models.dart';
import '../screens/ticket_screen.dart';
import '../store.dart';
import '../theme.dart';
import 'fare_breakdown.dart';
import 'mode_chip.dart';

/// Confirm sheet → POST /api/tickets → ticket screen. [departAt] is the time the options were planned for.
Future<void> startBooking(
  BuildContext context, {
  required TripRequest trip,
  required JourneyOption option,
  required String departAt,
}) async {
  final ticket = await showModalBottomSheet<Ticket>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    builder: (_) => _BookingSheet(trip: trip, option: option, departAt: departAt),
  );
  if (ticket == null || !context.mounted) return;
  AppStore.instance.tickets.add(ticket);
  Navigator.push(
    context,
    MaterialPageRoute(
      builder: (_) => TicketScreen(
        ticket: ticket,
        justBooked: true,
        routeChanged: ticket.signature != null && ticket.signature != option.signature,
      ),
    ),
  );
}

class _BookingSheet extends StatefulWidget {
  final TripRequest trip;
  final JourneyOption option;
  final String departAt;
  const _BookingSheet({required this.trip, required this.option, required this.departAt});

  @override
  State<_BookingSheet> createState() => _BookingSheetState();
}

class _BookingSheetState extends State<_BookingSheet> {
  bool _busy = false;
  String? _error;

  Future<void> _confirm() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final ticket = await Api.instance.bookTicket(widget.trip, widget.option, departAt: widget.departAt);
      if (mounted) Navigator.pop(context, ticket);
    } catch (e) {
      if (mounted) {
        setState(() {
          _busy = false;
          _error = e is ApiException ? e.message : 'Booking failed. Please try again.';
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final o = widget.option;
    final scheme = Theme.of(context).colorScheme;
    final text = Theme.of(context).textTheme;
    return ConstrainedBox(
      constraints: BoxConstraints(maxHeight: MediaQuery.sizeOf(context).height * 0.9),
      child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Flexible(
          child: SingleChildScrollView(
            padding: const EdgeInsets.fromLTRB(Space.xl, 0, Space.xl, Space.l),
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              Semantics(header: true, child: Text('Confirm your ticket', style: text.titleLarge)),
              const SizedBox(height: Space.l),
              _RouteSummary(trip: widget.trip, option: o),
              const SizedBox(height: Space.l),
              Card(
                child: Padding(padding: const EdgeInsets.all(Space.l), child: FareBreakdown.forOption(o)),
              ),
              const SizedBox(height: Space.l),
              Container(
                padding: const EdgeInsets.all(Space.m),
                decoration: BoxDecoration(color: scheme.surfaceContainerHighest, borderRadius: BorderRadius.circular(Radii.m)),
                child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Icon(Icons.storefront_outlined, color: scheme.onSurfaceVariant),
                  const SizedBox(width: Space.m),
                  Expanded(
                    child: Text(
                      'Pay at the counter. In-app payment is coming soon, so nothing is charged here. '
                      'Show your ticket code when you pay and board.',
                      style: text.bodyMedium,
                    ),
                  ),
                ]),
              ),
              if (_error != null) ...[
                const SizedBox(height: Space.l),
                Semantics(
                  liveRegion: true,
                  child: Container(
                    padding: const EdgeInsets.all(Space.m),
                    decoration: BoxDecoration(color: scheme.errorContainer, borderRadius: BorderRadius.circular(Radii.m)),
                    child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Icon(Icons.error_outline, color: scheme.onErrorContainer),
                      const SizedBox(width: Space.m),
                      Expanded(
                        child: Text('Couldn\'t book: $_error', style: text.bodyMedium?.copyWith(color: scheme.onErrorContainer)),
                      ),
                    ]),
                  ),
                ),
              ],
            ]),
          ),
        ),
        Material(
          color: scheme.surfaceContainer,
          child: SafeArea(
            top: false,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(Space.xl, Space.m, Space.xl, Space.m),
              child: Row(children: [
                TextButton(onPressed: _busy ? null : () => Navigator.pop(context), child: const Text('Cancel')),
                const SizedBox(width: Space.s),
                Expanded(
                  child: FilledButton(
                    onPressed: _busy ? null : _confirm,
                    child: _busy
                        ? Semantics(
                            label: 'Booking your ticket',
                            child: const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2.5)),
                          )
                        : Text(_error == null ? 'Confirm · ${rupees(o.fare)}' : 'Try again · ${rupees(o.fare)}'),
                  ),
                ),
              ]),
            ),
          ),
        ),
      ]),
    );
  }
}

class _RouteSummary extends StatelessWidget {
  final TripRequest trip;
  final JourneyOption option;
  const _RouteSummary({required this.trip, required this.option});

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final text = Theme.of(context).textTheme;
    final o = option;
    Widget place(IconData icon, Color color, String time, String name) => MergeSemantics(
          child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Icon(icon, size: 20, color: color),
            const SizedBox(width: Space.s),
            Text(time, style: text.titleSmall?.copyWith(fontWeight: FontWeight.w700)),
            const SizedBox(width: Space.s),
            Expanded(child: Text(name, style: text.bodyLarge)),
          ]),
        );
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      place(Icons.trip_origin, startColor, o.leaveTime, trip.from.label),
      Padding(
        padding: const EdgeInsets.only(left: 9),
        child: Container(width: 2, height: 16, color: scheme.outlineVariant),
      ),
      place(Icons.place, endColor, o.arriveTime, trip.to.label),
      const SizedBox(height: Space.m),
      LegSequence(legs: o.legs),
      const SizedBox(height: Space.s),
      Text(
        '${formatMin(o.totalMin)} · ${changesLabel(o.transfers)} · ${o.walkM == 0 ? 'no walking' : '${formatDistance(o.walkM)} walking'}',
        style: text.bodySmall?.copyWith(color: scheme.onSurfaceVariant),
      ),
    ]);
  }
}
