import 'package:flutter/material.dart';

import '../models.dart';
import '../theme.dart';

class ModeChip extends StatelessWidget {
  final String? mode;
  final String? text;
  final Color? color;
  final bool dense;

  const ModeChip({super.key, this.mode, this.text, this.color, this.dense = false});

  @override
  Widget build(BuildContext context) {
    final s = modeStyle(mode);
    final c = color ?? s.color;
    return Container(
      padding: EdgeInsets.symmetric(horizontal: dense ? 6 : 8, vertical: dense ? 2 : 4),
      decoration: BoxDecoration(color: c, borderRadius: BorderRadius.circular(8)),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        Icon(s.icon, size: dense ? 13 : 15, color: Colors.white),
        const SizedBox(width: 4),
        Text(text ?? s.label,
            style: TextStyle(color: Colors.white, fontWeight: FontWeight.w600, fontSize: dense ? 11 : 12)),
      ]),
    );
  }
}

/// Walk → Metro Blue → BRTS 4 … as a compact wrapped row.
class LegSequence extends StatelessWidget {
  final List<Leg> legs;
  const LegSequence({super.key, required this.legs});

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
          Text('${l.durationMin}', style: TextStyle(fontSize: 11, color: muted)),
        ]));
      } else {
        children.add(ModeChip(
          mode: l.mode,
          text: l.lineShortName,
          color: parseHex(l.color, modeStyle(l.mode).color),
          dense: true,
        ));
      }
    }
    return Wrap(crossAxisAlignment: WrapCrossAlignment.center, spacing: 2, runSpacing: 4, children: children);
  }
}
