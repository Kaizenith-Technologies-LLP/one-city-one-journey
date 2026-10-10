import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../theme.dart';

/// The scannable part of a ticket: its id and signed QR payload.
///
/// Shows the payload as a monospace ticket code. When qr_flutter is approved,
/// the QR image goes in this widget and nothing else needs to change.
class TicketCode extends StatelessWidget {
  final String ticketId;
  final String payload;
  final bool dimmed;

  const TicketCode({super.key, required this.ticketId, required this.payload, this.dimmed = false});

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final text = Theme.of(context).textTheme;
    return Opacity(
      opacity: dimmed ? 0.45 : 1,
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Semantics(
          label: 'Ticket number ${ticketId.split('').join(' ')}',
          child: ExcludeSemantics(
            child: FittedBox(
              fit: BoxFit.scaleDown,
              child: Text(
                ticketId,
                style: text.displaySmall?.copyWith(fontFamily: 'monospace', fontWeight: FontWeight.w800, letterSpacing: 2),
              ),
            ),
          ),
        ),
        const SizedBox(height: Space.m),
        Container(
          padding: const EdgeInsets.all(Space.m),
          decoration: BoxDecoration(
            color: scheme.surfaceContainerHighest,
            borderRadius: BorderRadius.circular(Radii.m),
            border: Border.all(color: scheme.outlineVariant),
          ),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Icon(Icons.qr_code_2, size: 20, color: scheme.onSurfaceVariant),
              const SizedBox(width: Space.s),
              Expanded(child: Text('Ticket code', style: text.labelLarge)),
              IconButton(
                tooltip: 'Copy ticket code',
                icon: const Icon(Icons.copy_rounded),
                onPressed: payload.isEmpty
                    ? null
                    : () {
                        Clipboard.setData(ClipboardData(text: payload));
                        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Ticket code copied')));
                      },
              ),
            ]),
            SelectableText(
              payload.isEmpty ? 'No code was returned for this ticket.' : payload,
              style: text.bodyMedium?.copyWith(fontFamily: 'monospace', height: 1.4),
            ),
          ]),
        ),
        const SizedBox(height: Space.s),
        Text('Show this code to staff at the gate or on board.',
            textAlign: TextAlign.center, style: text.bodySmall?.copyWith(color: scheme.onSurfaceVariant)),
      ]),
    );
  }
}
