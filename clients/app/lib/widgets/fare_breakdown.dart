import 'package:flutter/material.dart';

import '../models.dart';
import '../theme.dart';
import 'mode_chip.dart';

/// Integrated fare, savings against separate tickets and how operators share it.
class FareBreakdown extends StatelessWidget {
  final int fare;
  final int standaloneFare;
  final int savings;
  final int? discountPct;
  final List<LegFare> separateTickets;
  final List<OperatorShare> shares;
  final String? method;

  const FareBreakdown({
    super.key,
    required this.fare,
    required this.standaloneFare,
    required this.savings,
    required this.shares,
    this.discountPct,
    this.separateTickets = const [],
    this.method,
  });

  factory FareBreakdown.forOption(JourneyOption o) => FareBreakdown(
        fare: o.fare,
        standaloneFare: o.standaloneFare,
        savings: o.savings,
        discountPct: o.fareSplit.discountPct,
        separateTickets: o.tickets,
        shares: o.fareSplit.shares,
        method: o.fareSplit.method,
      );

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final text = Theme.of(context).textTheme;
    final muted = text.bodySmall?.copyWith(color: scheme.onSurfaceVariant);
    final total = shares.fold<double>(0, (s, e) => s + e.sharePct);
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      MergeSemantics(
        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('One integrated ticket', style: text.titleMedium),
              Text('Valid on every leg of this route', style: muted),
            ]),
          ),
          const SizedBox(width: Space.s),
          Text(rupees(fare), style: text.headlineSmall?.copyWith(color: scheme.primary)),
        ]),
      ),
      if (savings > 0) ...[
        const SizedBox(height: Space.m),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: Space.m, vertical: Space.s),
          decoration: BoxDecoration(
            color: successColor(context).withValues(alpha: 0.12),
            borderRadius: BorderRadius.circular(Radii.m),
          ),
          child: Row(children: [
            Icon(Icons.savings_outlined, color: successColor(context), size: 20),
            const SizedBox(width: Space.s),
            Expanded(
              child: Text(
                'You save ${rupees(savings)} vs ${rupees(standaloneFare)} in separate tickets'
                '${discountPct != null && discountPct! > 0 ? ' ($discountPct% multimodal discount)' : ''}',
                style: text.bodyMedium?.copyWith(color: successColor(context), fontWeight: FontWeight.w600),
              ),
            ),
          ]),
        ),
      ],
      if (separateTickets.length > 1) ...[
        const SizedBox(height: Space.l),
        Text('Separate tickets would cost', style: text.labelLarge),
        ...separateTickets.map((t) => Padding(
              padding: const EdgeInsets.only(top: Space.s),
              child: MergeSemantics(
                child: Row(children: [
                  ModeChip(mode: t.mode, dense: true),
                  const SizedBox(width: Space.s),
                  Expanded(child: Text('${t.km.toStringAsFixed(1)} km', style: muted)),
                  Text(rupees(t.fare)),
                ]),
              ),
            )),
      ],
      if (shares.isNotEmpty) ...[
        const SizedBox(height: Space.l),
        Text('How your fare is shared', style: text.labelLarge),
        const SizedBox(height: Space.s),
        ExcludeSemantics(
          child: ClipRRect(
            borderRadius: BorderRadius.circular(Radii.s),
            child: SizedBox(
              height: 12,
              child: Row(children: [
                for (var i = 0; i < shares.length; i++)
                  Expanded(
                    flex: total > 0 ? (shares[i].sharePct * 10).round().clamp(1, 1000) : 1,
                    child: Container(
                      margin: EdgeInsets.only(left: i == 0 ? 0 : 2),
                      color: shareColor(context, i),
                    ),
                  ),
              ]),
            ),
          ),
        ),
        for (var i = 0; i < shares.length; i++)
          Padding(
            padding: const EdgeInsets.only(top: Space.s),
            child: MergeSemantics(
              child: Builder(builder: (context) {
                final s = shares[i];
                return Row(children: [
                  Container(
                    width: 12,
                    height: 12,
                    decoration: BoxDecoration(color: shareColor(context, i), borderRadius: BorderRadius.circular(3)),
                  ),
                  const SizedBox(width: Space.s),
                  Icon(modeStyle(s.mode).icon, size: 18, color: scheme.onSurfaceVariant),
                  const SizedBox(width: Space.xs),
                  Expanded(child: Text(s.operatorName)),
                  Text('${s.sharePct.toStringAsFixed(0)}%', style: muted),
                  const SizedBox(width: Space.m),
                  Text(rupees(s.amount), style: const TextStyle(fontWeight: FontWeight.w600)),
                ]);
              }),
            ),
          ),
      ],
      if (method != null && method!.isNotEmpty) ...[
        const SizedBox(height: Space.s),
        Text('Rule: $method', style: muted),
      ],
    ]);
  }
}

/// Segment colour for the i-th operator share: steps of the primary colour.
Color shareColor(BuildContext context, int i) {
  const steps = [1.0, 0.6, 0.35, 0.18];
  return Theme.of(context).colorScheme.primary.withValues(alpha: steps[i % steps.length]);
}