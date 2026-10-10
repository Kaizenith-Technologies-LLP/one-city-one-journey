import 'package:flutter/material.dart';

import '../models.dart';
import '../store.dart';
import '../theme.dart';
import '../widgets/mode_chip.dart';
import '../widgets/state_views.dart';
import 'ticket_screen.dart';

/// Tickets booked on this phone.
class TicketsScreen extends StatelessWidget {
  final VoidCallback onPlanTrip;
  const TicketsScreen({super.key, required this.onPlanTrip});

  @override
  Widget build(BuildContext context) {
    final store = AppStore.instance.tickets;
    return Scaffold(
      appBar: AppBar(title: const Text('My tickets')),
      body: ListenableBuilder(
        listenable: store,
        builder: (context, _) {
          final tickets = store.items;
          if (tickets.isEmpty) {
            return MessageView(
              icon: Icons.confirmation_number_outlined,
              title: 'No tickets yet',
              message: 'Plan a trip and book one integrated ticket for every leg. '
                  'Tickets booked on this phone appear here until you close the app.',
              action: FilledButton.icon(onPressed: onPlanTrip, icon: const Icon(Icons.alt_route), label: const Text('Plan a trip')),
            );
          }
          final now = DateTime.now();
          return ListView.separated(
            padding: const EdgeInsets.all(Space.l),
            itemCount: tickets.length + 1,
            separatorBuilder: (_, _) => const SizedBox(height: Space.m),
            itemBuilder: (context, i) {
              if (i == tickets.length) {
                return Text(
                  'Tickets are kept on this phone until you close the app.',
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(color: Theme.of(context).colorScheme.onSurfaceVariant),
                );
              }
              return _TicketTile(ticket: tickets[i], now: now);
            },
          );
        },
      ),
    );
  }
}

class _TicketTile extends StatelessWidget {
  final Ticket ticket;
  final DateTime now;
  const _TicketTile({required this.ticket, required this.now});

  @override
  Widget build(BuildContext context) {
    final t = ticket;
    final text = Theme.of(context).textTheme;
    final scheme = Theme.of(context).colorScheme;
    final status = t.statusAt(now);
    final st = ticketStatusStyle(context, status);
    final validity = t.validUntil == null
        ? null
        : status == 'active'
            ? 'Valid until ${clockOf(t.validUntil!)}'
            : 'Was valid until ${clockOf(t.validUntil!)}';
    return Card(
      child: Semantics(
        button: true,
        label: 'Ticket ${t.id}, ${st.label}. ${t.from.label} to ${t.to.label}. ${rupees(t.fare)}. ${validity ?? ''}',
        excludeSemantics: true,
        child: InkWell(
          onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => TicketScreen(ticket: t))),
          child: Padding(
            padding: const EdgeInsets.all(Space.l),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                Expanded(
                  child: Text(t.id, style: text.titleMedium?.copyWith(fontFamily: 'monospace', fontWeight: FontWeight.w800)),
                ),
                Pill(text: st.label, icon: st.icon, background: st.bg, foreground: st.fg),
              ]),
              const SizedBox(height: Space.s),
              Text('${t.from.label} → ${t.to.label}', style: text.bodyLarge),
              const SizedBox(height: Space.s),
              Wrap(spacing: Space.xs, runSpacing: Space.xs, children: [
                ...t.legs.map((l) => ModeChip(mode: l.mode, line: l.line, dense: true)),
              ]),
              const SizedBox(height: Space.s),
              Row(children: [
                Expanded(child: Text(validity ?? '', style: text.bodySmall?.copyWith(color: scheme.onSurfaceVariant))),
                Text(rupees(t.fare), style: text.titleMedium?.copyWith(color: scheme.primary)),
              ]),
            ]),
          ),
        ),
      ),
    );
  }
}
