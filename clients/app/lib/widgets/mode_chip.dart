import 'package:flutter/material.dart';

import '../models.dart';
import '../theme.dart';

/// Mode icon + "Metro Blue" style label. Modes are told apart by icon and text, not colour.
class ModeChip extends StatelessWidget {
  final String? mode;
  final String? line;
  final bool dense;
  final bool emphasized;

  const ModeChip({super.key, this.mode, this.line, this.dense = false, this.emphasized = false});

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final s = modeStyle(mode);
    final label = lineLabel(mode, line);
    final bg = emphasized ? scheme.primary : scheme.secondaryContainer;
    final fg = emphasized ? scheme.onPrimary : scheme.onSecondaryContainer;
    return Semantics(
      label: label,
      child: ExcludeSemantics(
        child: Container(
          padding: EdgeInsets.symmetric(horizontal: dense ? 6 : 8, vertical: dense ? 3 : 5),
          decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(Radii.s)),
          child: Row(mainAxisSize: MainAxisSize.min, children: [
            Icon(s.icon, size: dense ? 15 : 17, color: fg),
            const SizedBox(width: 4),
            Flexible(
              child: Text(
                label,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(color: fg, fontWeight: FontWeight.w700, fontSize: dense ? 12 : 13),
              ),
            ),
          ]),
        ),
      ),
    );
  }
}

/// Walk 4 > Metro Blue > BRTS 4 ... as a compact wrapped row.
class LegSequence extends StatelessWidget {
  final List<Leg> legs;
  const LegSequence({super.key, required this.legs});

  static String describe(List<Leg> legs) =>
      legs.map((l) => l.isWalk ? 'walk ${l.durationMin} min' : lineLabel(l.mode, l.lineShortName ?? l.lineName)).join(', then ');

  @override
  Widget build(BuildContext context) {
    final muted = Theme.of(context).colorScheme.onSurfaceVariant;
    final children = <Widget>[];
    for (var i = 0; i < legs.length; i++) {
      final l = legs[i];
      if (i > 0) children.add(Icon(Icons.chevron_right, size: 16, color: muted));
      if (l.isWalk) {
        children.add(Row(mainAxisSize: MainAxisSize.min, children: [
          Icon(Icons.directions_walk, size: 16, color: muted),
          Text('${l.durationMin}', style: TextStyle(fontSize: 12, color: muted, fontWeight: FontWeight.w600)),
        ]));
      } else {
        children.add(ModeChip(mode: l.mode, line: l.lineShortName, dense: true));
      }
    }
    return Semantics(
      label: describe(legs),
      child: ExcludeSemantics(
        child: Wrap(crossAxisAlignment: WrapCrossAlignment.center, spacing: 2, runSpacing: 6, children: children),
      ),
    );
  }
}
