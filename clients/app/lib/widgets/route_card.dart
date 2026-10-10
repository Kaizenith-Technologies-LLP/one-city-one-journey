import 'package:flutter/material.dart';

import '../models.dart';
import '../theme.dart';
import 'mode_chip.dart';
import 'state_views.dart';

/// A journey option in the results list. [featured] makes it the prominent top card.
class RouteCard extends StatelessWidget {
  final JourneyOption option;
  final bool featured;
  final String? featuredLabel;
  final VoidCallback onOpen;
  final VoidCallback onBook;

  const RouteCard({
    super.key,
    required this.option,
    required this.onOpen,
    required this.onBook,
    this.featured = false,
    this.featuredLabel,
  });

  String _spoken() {
    final o = option;
    return [
      ?featuredLabel,
      'Leave ${o.leaveTime}, arrive ${o.arriveTime}',
      formatMin(o.totalMin),
      changesLabel(o.transfers),
      if (o.walkM > 0) '${formatDistance(o.walkM)} walking',
      'Fare ${rupees(o.fare)}',
      LegSequence.describe(o.legs),
      if (featured && o.reason != null) o.reason!,
    ].join('. ');
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final text = Theme.of(context).textTheme;
    final o = option;
    final muted = text.bodySmall?.copyWith(color: scheme.onSurfaceVariant);
    final otherTags = o.tags.where((t) => tagLabels[t] != featuredLabel).toList();

    final body = Padding(
      padding: EdgeInsets.fromLTRB(Space.l, featured ? Space.l : Space.m, Space.l, Space.s),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        if (featured && featuredLabel != null || otherTags.isNotEmpty)
          Padding(
            padding: const EdgeInsets.only(bottom: Space.s),
            child: Wrap(spacing: Space.xs, runSpacing: Space.xs, children: [
              if (featured && featuredLabel != null)
                Pill(text: featuredLabel!, icon: Icons.star_rounded, background: scheme.primary, foreground: scheme.onPrimary),
              ...otherTags.map((t) => Pill(
                    text: tagLabels[t] ?? t,
                    background: scheme.secondaryContainer,
                    foreground: scheme.onSecondaryContainer,
                  )),
            ]),
          ),
        Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(
                '${o.leaveTime} → ${o.arriveTime}',
                style: (featured ? text.headlineSmall : text.titleLarge)?.copyWith(fontFeatures: const [FontFeature.tabularFigures()]),
              ),
              Text(formatMin(o.totalMin), style: text.bodyMedium?.copyWith(color: scheme.onSurfaceVariant, fontWeight: FontWeight.w600)),
            ]),
          ),
          const SizedBox(width: Space.s),
          Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
            Text(rupees(o.fare), style: text.titleLarge?.copyWith(color: scheme.primary)),
            if (o.standaloneFare > o.fare)
              Text(rupees(o.standaloneFare), style: muted?.copyWith(decoration: TextDecoration.lineThrough)),
          ]),
        ]),
        const SizedBox(height: Space.m),
        LegSequence(legs: o.legs),
        const SizedBox(height: Space.m),
        DefaultTextStyle(
          style: muted ?? const TextStyle(),
          child: Wrap(spacing: Space.l, runSpacing: Space.xs, children: [
            _Stat(Icons.sync_alt_rounded, changesLabel(o.transfers)),
            _Stat(Icons.directions_walk, o.walkM == 0 ? 'No walking' : '${formatDistance(o.walkM)} · ${o.walkMin} min'),
            if (o.waitMin > 0) _Stat(Icons.hourglass_bottom_rounded, '${o.waitMin} min wait'),
          ]),
        ),
        if (featured && o.reason != null) ...[
          const SizedBox(height: Space.m),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(Space.m),
            decoration: BoxDecoration(color: scheme.primaryContainer.withValues(alpha: 0.6), borderRadius: BorderRadius.circular(Radii.m)),
            child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Icon(Icons.lightbulb_outline_rounded, size: 18, color: scheme.onPrimaryContainer),
              const SizedBox(width: Space.s),
              Expanded(child: Text(o.reason!, style: text.bodyMedium?.copyWith(color: scheme.onPrimaryContainer))),
            ]),
          ),
        ],
      ]),
    );

    return Card(
      elevation: featured ? 2 : 0,
      color: featured ? scheme.surfaceContainerHigh : null,
      shape: featured
          ? RoundedRectangleBorder(borderRadius: BorderRadius.circular(Radii.l), side: BorderSide(color: scheme.primary, width: 1.5))
          : null,
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Semantics(
          button: true,
          label: _spoken(),
          hint: 'Opens route details',
          excludeSemantics: true,
          child: InkWell(onTap: onOpen, child: body),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(Space.l, 0, Space.l, Space.m),
          child: Row(children: [
            TextButton(onPressed: onOpen, child: const Text('Details')),
            const SizedBox(width: Space.s),
            Expanded(
              child: featured
                  ? FilledButton.icon(
                      onPressed: onBook,
                      icon: const Icon(Icons.confirmation_number_outlined),
                      label: Text('Book ${rupees(o.fare)}'),
                    )
                  : FilledButton.tonalIcon(
                      onPressed: onBook,
                      icon: const Icon(Icons.confirmation_number_outlined),
                      label: Text('Book ${rupees(o.fare)}'),
                    ),
            ),
          ]),
        ),
      ]),
    );
  }
}

class _Stat extends StatelessWidget {
  final IconData icon;
  final String text;
  const _Stat(this.icon, this.text);

  @override
  Widget build(BuildContext context) => Row(mainAxisSize: MainAxisSize.min, children: [
        Icon(icon, size: 16, color: Theme.of(context).colorScheme.onSurfaceVariant),
        const SizedBox(width: Space.xs),
        Flexible(child: Text(text)),
      ]);
}
