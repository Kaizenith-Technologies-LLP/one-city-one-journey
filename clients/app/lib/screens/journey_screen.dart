import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';

import '../models.dart';
import '../theme.dart';
import '../widgets/mode_chip.dart';
import '../widgets/transit_map.dart';

class JourneyScreen extends StatelessWidget {
  final JourneyOption option;
  final Place from;
  final Place to;
  const JourneyScreen({super.key, required this.option, required this.from, required this.to});

  @override
  Widget build(BuildContext context) {
    final o = option;
    final polylines = <Polyline>[];
    final markers = <Marker>[];
    final points = <LatLng>[];
    for (final l in o.legs) {
      points.addAll(l.points);
      if (l.isWalk) {
        polylines.add(Polyline(points: l.points, color: Colors.grey.shade700, strokeWidth: 4, pattern: StrokePattern.dotted()));
      } else {
        final c = parseHex(l.color, modeStyle(l.mode).color);
        polylines.add(Polyline(points: l.points, color: c, strokeWidth: 6, borderColor: Colors.white, borderStrokeWidth: 1.5));
        markers.add(dotMarker(l.from, c, size: 16));
        markers.add(dotMarker(l.to, c, size: 16));
      }
    }
    markers.add(pinMarker(o.legs.first.from, Colors.green.shade700, Icons.trip_origin));
    markers.add(pinMarker(o.legs.last.to, Colors.red.shade700, Icons.place));

    return Scaffold(
      appBar: AppBar(title: Text('${formatMin(o.totalMin)} · ${rupees(o.fare)}')),
      body: Column(children: [
        SizedBox(
          height: MediaQuery.sizeOf(context).height * 0.36,
          child: TransitMap(polylines: polylines, markers: markers, fitPoints: points),
        ),
        Expanded(
          child: ListView(padding: const EdgeInsets.all(16), children: [
            _Summary(option: o),
            const SizedBox(height: 16),
            Text('Step by step', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
            const SizedBox(height: 8),
            _StepTile(isStart: true, title: from.label, color: Colors.green.shade700),
            ...o.legs.map((l) => _LegTile(leg: l)),
            _StepTile(isStart: false, title: to.label, color: Colors.red.shade700),
            const SizedBox(height: 16),
            FareCard(option: o),
          ]),
        ),
      ]),
    );
  }
}

class _Summary extends StatelessWidget {
  final JourneyOption option;
  const _Summary({required this.option});

  @override
  Widget build(BuildContext context) {
    final o = option;
    Widget cell(String value, String label) => Expanded(
          child: Column(children: [
            Text(value, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
            Text(label, style: TextStyle(fontSize: 11, color: Theme.of(context).colorScheme.onSurfaceVariant)),
          ]),
        );
    return Card(
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 14),
        child: Row(children: [
          cell('${o.rideMin}m', 'riding'),
          cell('${o.waitMin}m', 'waiting'),
          cell('${o.walkMin}m', 'walking'),
          cell('${o.transfers}', 'changes'),
        ]),
      ),
    );
  }
}

class _StepTile extends StatelessWidget {
  final bool isStart;
  final String title;
  final Color color;
  const _StepTile({required this.isStart, required this.title, required this.color});

  @override
  Widget build(BuildContext context) => ListTile(
        contentPadding: EdgeInsets.zero,
        leading: Icon(isStart ? Icons.trip_origin : Icons.place, color: color),
        title: Text(title, style: const TextStyle(fontWeight: FontWeight.w600)),
        subtitle: Text(isStart ? 'Start' : 'Arrive'),
      );
}

class _LegTile extends StatefulWidget {
  final Leg leg;
  const _LegTile({required this.leg});

  @override
  State<_LegTile> createState() => _LegTileState();
}

class _LegTileState extends State<_LegTile> {
  bool _expanded = false;

  @override
  Widget build(BuildContext context) {
    final l = widget.leg;
    final scheme = Theme.of(context).colorScheme;
    final color = l.isWalk ? scheme.outline : parseHex(l.color, modeStyle(l.mode).color);
    return IntrinsicHeight(
      child: Row(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        SizedBox(
          width: 40,
          child: Center(
            child: Container(
              width: l.isWalk ? 3 : 6,
              decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(3)),
            ),
          ),
        ),
        Expanded(
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 8),
            child: l.isWalk ? _walk(l, scheme) : _ride(l, scheme, color),
          ),
        ),
      ]),
    );
  }

  Widget _walk(Leg l, ColorScheme scheme) => Row(children: [
        Icon(Icons.directions_walk, size: 18, color: scheme.onSurfaceVariant),
        const SizedBox(width: 6),
        Expanded(
          child: Text(
            l.toHubId != null ? '${l.instruction} · interchange' : l.instruction,
            style: TextStyle(color: scheme.onSurfaceVariant),
          ),
        ),
      ]);

  Widget _ride(Leg l, ColorScheme scheme, Color color) {
    final intermediate = l.path.length > 2 ? l.path.sublist(1, l.path.length - 1) : <PathPoint>[];
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Row(children: [
        ModeChip(mode: l.mode, text: '${modeStyle(l.mode).label} ${l.lineShortName ?? ''}', color: color),
        const SizedBox(width: 8),
        Expanded(child: Text('towards ${l.towards}', style: TextStyle(fontSize: 12, color: scheme.onSurfaceVariant))),
      ]),
      const SizedBox(height: 6),
      Text('Board at ${l.fromName}', style: const TextStyle(fontWeight: FontWeight.w600)),
      Text(
        'Every ${l.headwayMin} min (~${l.waitMin} min wait) · ${l.rideMin} min ride · ${l.distanceKm.toStringAsFixed(1)} km',
        style: TextStyle(fontSize: 12, color: scheme.onSurfaceVariant),
      ),
      if (intermediate.isNotEmpty)
        TextButton(
          style: TextButton.styleFrom(padding: EdgeInsets.zero, visualDensity: VisualDensity.compact),
          onPressed: () => setState(() => _expanded = !_expanded),
          child: Text('${_expanded ? 'Hide' : 'Show'} ${l.stopCount} stops'),
        ),
      if (_expanded)
        ...intermediate.map((p) => Padding(
              padding: const EdgeInsets.only(left: 4, bottom: 2),
              child: Text('• ${p.name}', style: TextStyle(fontSize: 12, color: scheme.onSurfaceVariant)),
            )),
      Text('Get off at ${l.toName}', style: const TextStyle(fontWeight: FontWeight.w600)),
    ]);
  }
}

/// Integrated ticket price and how the fare is shared between operators.
class FareCard extends StatelessWidget {
  final JourneyOption option;
  const FareCard({super.key, required this.option});

  @override
  Widget build(BuildContext context) {
    final f = option.fareSplit;
    final scheme = Theme.of(context).colorScheme;
    final text = Theme.of(context).textTheme;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            const Icon(Icons.confirmation_number_outlined),
            const SizedBox(width: 8),
            Text('One integrated ticket', style: text.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
            const Spacer(),
            Text(rupees(f.integratedFare), style: text.titleLarge?.copyWith(fontWeight: FontWeight.w700, color: scheme.primary)),
          ]),
          if (f.savings > 0)
            Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Text('Saves ${rupees(f.savings)} vs ${option.tickets.length} separate tickets (${f.discountPct}% multimodal discount)',
                  style: TextStyle(color: Colors.green.shade700, fontSize: 12)),
            ),
          const SizedBox(height: 12),
          Text('Separate tickets', style: text.labelLarge),
          ...option.tickets.map((t) => Padding(
                padding: const EdgeInsets.only(top: 6),
                child: Row(children: [
                  ModeChip(mode: t.mode, dense: true),
                  const SizedBox(width: 8),
                  Text('${t.km.toStringAsFixed(1)} km'),
                  const Spacer(),
                  Text(rupees(t.fare)),
                ]),
              )),
          const Divider(height: 24),
          Text('Revenue split between operators', style: text.labelLarge),
          const SizedBox(height: 8),
          ClipRRect(
            borderRadius: BorderRadius.circular(6),
            child: SizedBox(
              height: 14,
              child: Row(
                children: f.shares
                    .map((s) => Expanded(
                          flex: (s.sharePct * 10).round().clamp(1, 1000),
                          child: Container(color: modeStyle(s.mode).color),
                        ))
                    .toList(),
              ),
            ),
          ),
          ...f.shares.map((s) => Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Row(children: [
                  Container(width: 10, height: 10, decoration: BoxDecoration(color: modeStyle(s.mode).color, shape: BoxShape.circle)),
                  const SizedBox(width: 8),
                  Expanded(child: Text(s.operatorName, overflow: TextOverflow.ellipsis)),
                  Text('${s.sharePct.toStringAsFixed(1)}%  ', style: TextStyle(color: scheme.onSurfaceVariant)),
                  Text(rupees(s.amount), style: const TextStyle(fontWeight: FontWeight.w600)),
                ]),
              )),
          const SizedBox(height: 10),
          Text('Rule: ${f.method}', style: TextStyle(fontSize: 11, color: scheme.onSurfaceVariant)),
        ]),
      ),
    );
  }
}
