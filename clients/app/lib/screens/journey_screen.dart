import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';

import '../models.dart';
import '../theme.dart';
import '../widgets/booking_sheet.dart';
import '../widgets/fare_breakdown.dart';
import '../widgets/mode_chip.dart';
import '../widgets/state_views.dart';
import '../widgets/transit_map.dart';

class JourneyScreen extends StatelessWidget {
  final TripRequest trip;
  final JourneyOption option;
  final String departAt;
  const JourneyScreen({super.key, required this.trip, required this.option, required this.departAt});

  @override
  Widget build(BuildContext context) {
    final o = option;
    final scheme = Theme.of(context).colorScheme;
    final text = Theme.of(context).textTheme;
    final polylines = <Polyline>[];
    final markers = <Marker>[];
    final points = <LatLng>[];
    for (final l in o.legs) {
      points.addAll(l.points);
      if (l.isWalk) {
        polylines.add(Polyline(
          points: l.points,
          color: AppColors.neutral,
          strokeWidth: 4,
          pattern: StrokePattern.dashed(segments: const [10, 8]),
        ));
      } else {
        polylines.add(Polyline(
          points: l.points,
          color: AppColors.primary,
          strokeWidth: 6,
          borderColor: AppColors.paper,
          borderStrokeWidth: 1.5,
        ));
        markers.add(dotMarker(l.from.point, AppColors.primary, size: 16));
        markers.add(dotMarker(l.to.point, AppColors.primary, size: 16));
      }
    }
    if (o.legs.isNotEmpty) {
      markers.add(pinMarker(o.legs.first.from.point, startColor, Icons.trip_origin));
      markers.add(pinMarker(o.legs.last.to.point, endColor, Icons.place));
    }

    return Scaffold(
      appBar: AppBar(title: Text('${o.leaveTime} → ${o.arriveTime}')),
      body: Column(children: [
        SizedBox(
          height: MediaQuery.sizeOf(context).height * 0.28,
          child: TransitMap(polylines: polylines, markers: markers, fitPoints: points),
        ),
        Expanded(
          child: ListView(padding: const EdgeInsets.fromLTRB(Space.l, Space.l, Space.l, Space.xl), children: [
            _Summary(option: o),
            const SizedBox(height: Space.l),
            const SectionHeader('Your journey'),
            _Timeline(trip: trip, option: o),
            const SizedBox(height: Space.l),
            Card(child: Padding(padding: const EdgeInsets.all(Space.l), child: FareBreakdown.forOption(o))),
          ]),
        ),
      ]),
      bottomNavigationBar: Material(
        color: scheme.surfaceContainer,
        elevation: 3,
        child: SafeArea(
          top: false,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(Space.l, Space.m, Space.l, Space.m),
            child: Row(children: [
              MergeSemantics(
                child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(rupees(o.fare), style: text.headlineSmall?.copyWith(color: scheme.primary)),
                  Text(o.savings > 0 ? 'Save ${rupees(o.savings)}' : 'One ticket', style: text.bodySmall?.copyWith(
                    color: o.savings > 0 ? successColor(context) : scheme.onSurfaceVariant,
                    fontWeight: FontWeight.w600,
                  )),
                ]),
              ),
              const SizedBox(width: Space.l),
              Expanded(
                child: FilledButton.icon(
                  onPressed: () => startBooking(context, trip: trip, option: o, departAt: departAt),
                  icon: const Icon(Icons.confirmation_number_outlined),
                  label: const Text('Book ticket'),
                ),
              ),
            ]),
          ),
        ),
      ),
    );
  }
}

class _Summary extends StatelessWidget {
  final JourneyOption option;
  const _Summary({required this.option});

  @override
  Widget build(BuildContext context) {
    final o = option;
    final scheme = Theme.of(context).colorScheme;
    final text = Theme.of(context).textTheme;
    Widget cell(String value, String label) => Expanded(
          child: MergeSemantics(
            child: Column(children: [
              Text(value, textAlign: TextAlign.center, style: text.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
              Text(label, textAlign: TextAlign.center, style: text.bodySmall?.copyWith(color: scheme.onSurfaceVariant)),
            ]),
          ),
        );
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      if (o.tags.isNotEmpty)
        Padding(
          padding: const EdgeInsets.only(bottom: Space.s),
          child: Wrap(
            spacing: Space.xs,
            runSpacing: Space.xs,
            children: o.tags
                .map((t) => Pill(
                      text: tagLabels[t] ?? t,
                      background: t == 'recommended' ? scheme.primary : scheme.secondaryContainer,
                      foreground: t == 'recommended' ? scheme.onPrimary : scheme.onSecondaryContainer,
                    ))
                .toList(),
          ),
        ),
      LegSequence(legs: o.legs),
      if (o.reason != null) ...[
        const SizedBox(height: Space.m),
        Container(
          padding: const EdgeInsets.all(Space.m),
          decoration: BoxDecoration(color: scheme.primaryContainer.withValues(alpha: 0.6), borderRadius: BorderRadius.circular(Radii.m)),
          child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Icon(Icons.lightbulb_outline_rounded, size: 18, color: scheme.onPrimaryContainer),
            const SizedBox(width: Space.s),
            Expanded(child: Text(o.reason!, style: text.bodyMedium?.copyWith(color: scheme.onPrimaryContainer))),
          ]),
        ),
      ],
      const SizedBox(height: Space.m),
      Card(
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: Space.m, horizontal: Space.xs),
          child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            cell(formatMin(o.totalMin), 'total'),
            cell(changesLabel(o.transfers), 'changes'),
            cell(o.walkM == 0 ? 'None' : formatDistance(o.walkM), 'walking'),
            cell('${o.waitMin} min', 'waiting'),
          ]),
        ),
      ),
    ]);
  }
}

/// Vertical timeline: clock times, a coloured rail and one step per stop or walk.
class _Timeline extends StatelessWidget {
  final TripRequest trip;
  final JourneyOption option;
  const _Timeline({required this.trip, required this.option});

  @override
  Widget build(BuildContext context) {
    final o = option;
    final walk = Theme.of(context).colorScheme.outline;
    final ride = Theme.of(context).colorScheme.primary;
    final legs = o.legs;
    _Rail railOf(Leg? l) => l == null ? _Rail.none : (l.isWalk ? _Rail(walk, dashed: true) : _Rail(ride));
    final steps = <Widget>[
      _Step(
        time: o.leaveTime,
        dot: startColor,
        above: _Rail.none,
        below: railOf(legs.isEmpty ? null : legs.first),
        child: _PlaceText(title: trip.from.label, subtitle: 'Start'),
      ),
    ];
    for (var i = 0; i < legs.length; i++) {
      final l = legs[i];
      final next = i + 1 < legs.length ? legs[i + 1] : null;
      if (l.isWalk) {
        steps.add(_Step(time: l.departTime, above: railOf(l), below: railOf(l), child: _WalkStep(leg: l)));
      } else {
        steps.add(_Step(
          time: l.departTime,
          dot: ride,
          hollow: true,
          above: railOf(i == 0 ? null : legs[i - 1]),
          below: _Rail(ride),
          child: _BoardStep(leg: l),
        ));
        steps.add(_Step(
          time: l.arriveTime,
          dot: ride,
          hollow: true,
          above: _Rail(ride),
          below: railOf(next),
          child: _PlaceText(title: l.to.label, subtitle: next != null && (!next.isWalk || next.isTransfer) ? 'Get off and change' : 'Get off'),
        ));
      }
    }
    steps.add(_Step(
      time: o.arriveTime,
      dot: endColor,
      above: railOf(legs.isEmpty ? null : legs.last),
      below: _Rail.none,
      child: _PlaceText(title: trip.to.label, subtitle: 'Arrive'),
    ));
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: steps);
  }
}

class _Rail {
  final Color? color;
  final bool dashed;
  const _Rail(this.color, {this.dashed = false});
  static const none = _Rail(null);
}

class _Step extends StatelessWidget {
  final String time;
  final Color? dot;
  final bool hollow;
  final _Rail above;
  final _Rail below;
  final Widget child;

  const _Step({required this.time, required this.above, required this.below, required this.child, this.dot, this.hollow = false});

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final text = Theme.of(context).textTheme;
    final timeWidth = MediaQuery.textScalerOf(context).scale(48);
    const dotSize = 16.0;
    const dotTop = 4.0;
    return IntrinsicHeight(
      child: Row(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        SizedBox(
          width: timeWidth,
          child: Padding(
            padding: const EdgeInsets.only(top: 2),
            child: Text(
              time,
              style: dot == null
                  ? text.bodySmall?.copyWith(color: scheme.onSurfaceVariant, fontFeatures: const [FontFeature.tabularFigures()])
                  : text.titleSmall?.copyWith(fontWeight: FontWeight.w700, fontFeatures: const [FontFeature.tabularFigures()]),
            ),
          ),
        ),
        SizedBox(
          width: 28,
          child: Column(children: [
            SizedBox(height: dotTop, child: _Segment(rail: above)),
            if (dot != null)
              Container(
                width: dotSize,
                height: dotSize,
                decoration: BoxDecoration(
                  color: hollow ? scheme.surface : dot,
                  shape: BoxShape.circle,
                  border: Border.all(color: dot!, width: hollow ? 4 : 0),
                ),
              )
            else
              SizedBox(height: dotSize, child: _Segment(rail: above)),
            Expanded(child: _Segment(rail: below)),
          ]),
        ),
        const SizedBox(width: Space.s),
        Expanded(child: Padding(padding: const EdgeInsets.only(bottom: Space.l), child: child)),
      ]),
    );
  }
}

class _Segment extends StatelessWidget {
  final _Rail rail;
  const _Segment({required this.rail});

  @override
  Widget build(BuildContext context) {
    if (rail.color == null) return const SizedBox.expand();
    return CustomPaint(painter: _SegmentPainter(rail.color!, rail.dashed), child: const SizedBox.expand());
  }
}

class _SegmentPainter extends CustomPainter {
  final Color color;
  final bool dashed;
  _SegmentPainter(this.color, this.dashed);

  @override
  void paint(Canvas canvas, Size size) {
    final x = size.width / 2;
    final paint = Paint()..color = color;
    if (!dashed) {
      canvas.drawRRect(
        RRect.fromRectAndRadius(Rect.fromLTWH(x - 3, 0, 6, size.height), const Radius.circular(3)),
        paint,
      );
      return;
    }
    for (double y = 0; y < size.height; y += 10) {
      canvas.drawRRect(
        RRect.fromRectAndRadius(Rect.fromLTWH(x - 1.5, y, 3, (size.height - y).clamp(0, 6)), const Radius.circular(1.5)),
        paint,
      );
    }
  }

  @override
  bool shouldRepaint(_SegmentPainter old) => old.color != color || old.dashed != dashed;
}

class _PlaceText extends StatelessWidget {
  final String title;
  final String subtitle;
  const _PlaceText({required this.title, required this.subtitle});

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    return MergeSemantics(
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(title, style: text.titleMedium),
        Text(subtitle, style: text.bodySmall?.copyWith(color: Theme.of(context).colorScheme.onSurfaceVariant)),
      ]),
    );
  }
}

class _WalkStep extends StatelessWidget {
  final Leg leg;
  const _WalkStep({required this.leg});

  @override
  Widget build(BuildContext context) {
    final l = leg;
    final scheme = Theme.of(context).colorScheme;
    final text = Theme.of(context).textTheme;
    final target = l.to.mode != null ? '${l.to.label} (${modeStyle(l.to.mode).label})' : l.to.label;
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Container(
        padding: const EdgeInsets.symmetric(horizontal: Space.m, vertical: Space.s),
        decoration: BoxDecoration(color: scheme.surfaceContainerHighest, borderRadius: BorderRadius.circular(Radii.m)),
        child: MergeSemantics(
          child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Icon(l.isTransfer ? Icons.transfer_within_a_station : Icons.directions_walk, size: 20, color: scheme.onSurfaceVariant),
            const SizedBox(width: Space.s),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(
                  l.isTransfer ? 'Change: walk to $target' : 'Walk to $target',
                  style: text.bodyMedium?.copyWith(fontWeight: FontWeight.w600),
                ),
                Text(
                  '${formatDistance(l.distanceM)} · about ${l.durationMin} min',
                  style: text.bodySmall?.copyWith(color: scheme.onSurfaceVariant),
                ),
              ]),
            ),
          ]),
        ),
      ),
      if (l.heatWarning != null && l.heatWarning!.isNotEmpty) ...[
        const SizedBox(height: Space.xs),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: Space.m, vertical: Space.s),
          decoration: BoxDecoration(color: warningColor(context).withValues(alpha: 0.12), borderRadius: BorderRadius.circular(Radii.m)),
          child: MergeSemantics(
            child: Row(children: [
              Icon(Icons.thermostat_rounded, size: 18, color: warningColor(context)),
              const SizedBox(width: Space.s),
              Expanded(
                child: Text('Heat: ${l.heatWarning!}. Carry water and seek shade.',
                    style: text.bodySmall?.copyWith(fontWeight: FontWeight.w600)),
              ),
            ]),
          ),
        ),
      ],
    ]);
  }
}

class _BoardStep extends StatefulWidget {
  final Leg leg;
  const _BoardStep({required this.leg});

  @override
  State<_BoardStep> createState() => _BoardStepState();
}

class _BoardStepState extends State<_BoardStep> {
  bool _expanded = false;

  @override
  Widget build(BuildContext context) {
    final l = widget.leg;
    final scheme = Theme.of(context).colorScheme;
    final text = Theme.of(context).textTheme;
    final c = scheme.primary;
    final muted = text.bodySmall?.copyWith(color: scheme.onSurfaceVariant);
    final stops = l.intermediateStops;
    final line = l.lineShortName ?? l.lineName ?? '';
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      MergeSemantics(
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(l.from.label, style: text.titleMedium),
          if (l.waitMin > 0) Text('Wait about ${l.waitMin} min', style: muted),
        ]),
      ),
      const SizedBox(height: Space.s),
      Container(
        padding: const EdgeInsets.all(Space.m),
        decoration: BoxDecoration(
          color: scheme.primaryContainer.withValues(alpha: 0.5),
          borderRadius: BorderRadius.circular(Radii.m),
          border: Border(left: BorderSide(color: c, width: 4)),
        ),
        child: MergeSemantics(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Flexible(child: ModeChip(mode: l.mode, line: line, emphasized: true)),
              if (l.lineName != null && l.lineName != line) ...[
                const SizedBox(width: Space.s),
                Expanded(child: Text(l.lineName!, style: muted, overflow: TextOverflow.ellipsis)),
              ],
            ]),
            const SizedBox(height: Space.s),
            Text.rich(
              TextSpan(children: [
                const TextSpan(text: 'Board towards '),
                TextSpan(text: l.towards ?? l.to.label, style: const TextStyle(fontWeight: FontWeight.w800)),
              ]),
              style: text.titleMedium,
            ),
            const SizedBox(height: Space.xs),
            Text(
              [
                '${plural(l.stopCount, 'stop')} · ${l.rideMin} min',
                if (l.headwayMin != null) 'every ${l.headwayMin} min',
                if (l.operator != null) l.operator!.toUpperCase(),
              ].join(' · '),
              style: muted,
            ),
          ]),
        ),
      ),
      if (stops.isNotEmpty) ...[
        TextButton.icon(
          onPressed: () => setState(() => _expanded = !_expanded),
          icon: Icon(_expanded ? Icons.expand_less : Icons.expand_more),
          label: Text(_expanded ? 'Hide stops' : 'Show ${plural(stops.length, 'stop')} on the way'),
        ),
        if (_expanded)
          ...stops.map((p) => Padding(
                padding: const EdgeInsets.only(left: Space.s, bottom: Space.xs),
                child: Row(children: [
                  Container(width: 8, height: 8, decoration: BoxDecoration(color: c, shape: BoxShape.circle)),
                  const SizedBox(width: Space.m),
                  Expanded(child: Text(p.name, style: text.bodyMedium)),
                ]),
              )),
      ],
    ]);
  }
}
