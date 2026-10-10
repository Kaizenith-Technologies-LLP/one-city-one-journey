import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';

import '../api.dart';
import '../models.dart';
import '../theme.dart';
import '../widgets/mode_chip.dart';
import '../widgets/transit_map.dart';

const _typeLabels = {
  'dual': 'Dual interchange',
  'triple': 'Triple interchange',
  'quad': '4-mode interchange',
  'penta': '5-mode interchange',
};

/// Overlapping stations: places where stops of different modes meet.
class HubsScreen extends StatefulWidget {
  const HubsScreen({super.key});

  @override
  State<HubsScreen> createState() => _HubsScreenState();
}

class _HubsScreenState extends State<HubsScreen> {
  late Future<List<Hub>> _future = Api.instance.hubs();
  bool _showMap = false;
  int _minModes = 2;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Overlapping stations'),
        actions: [
          IconButton(
            tooltip: _showMap ? 'List' : 'Map',
            icon: Icon(_showMap ? Icons.list : Icons.map_outlined),
            onPressed: () => setState(() => _showMap = !_showMap),
          ),
        ],
      ),
      body: FutureBuilder<List<Hub>>(
        future: _future,
        builder: (context, snap) {
          if (snap.connectionState != ConnectionState.done) return const Center(child: CircularProgressIndicator());
          if (snap.hasError) {
            return Center(
              child: Column(mainAxisSize: MainAxisSize.min, children: [
                Text(snap.error.toString()),
                const SizedBox(height: 12),
                FilledButton(onPressed: () => setState(() => _future = Api.instance.hubs()), child: const Text('Retry')),
              ]),
            );
          }
          final hubs = snap.data!.where((h) => h.modes.length >= _minModes).toList();
          final counts = <int, int>{};
          for (final h in snap.data!) {
            counts[h.modes.length] = (counts[h.modes.length] ?? 0) + 1;
          }
          return Column(children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 4, 12, 8),
              child: Row(children: [
                ChoiceChip(label: Text('All (${snap.data!.length})'), selected: _minModes == 2, onSelected: (_) => setState(() => _minModes = 2)),
                const SizedBox(width: 8),
                ChoiceChip(
                  label: Text('3+ modes (${snap.data!.where((h) => h.modes.length >= 3).length})'),
                  selected: _minModes == 3,
                  onSelected: (_) => setState(() => _minModes = 3),
                ),
              ]),
            ),
            Expanded(child: _showMap ? _HubMap(hubs: hubs) : _HubList(hubs: hubs)),
          ]);
        },
      ),
    );
  }
}

class _HubList extends StatelessWidget {
  final List<Hub> hubs;
  const _HubList({required this.hubs});

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return ListView.separated(
      padding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
      itemCount: hubs.length,
      separatorBuilder: (_, _) => const SizedBox(height: 8),
      itemBuilder: (_, i) {
        final h = hubs[i];
        return Card(
          child: ListTile(
            onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => HubDetailScreen(hub: h))),
            title: Text(h.name, style: const TextStyle(fontWeight: FontWeight.w600)),
            subtitle: Padding(
              padding: const EdgeInsets.only(top: 6),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Wrap(spacing: 4, runSpacing: 4, children: h.modes.map((m) => ModeChip(mode: m, dense: true)).toList()),
                const SizedBox(height: 6),
                Text('${_typeLabels[h.type] ?? h.type} · ${h.lineCount} lines · max walk ${h.maxWalkM} m',
                    style: TextStyle(fontSize: 12, color: scheme.onSurfaceVariant)),
              ]),
            ),
            trailing: const Icon(Icons.chevron_right),
          ),
        );
      },
    );
  }
}

class _HubMap extends StatelessWidget {
  final List<Hub> hubs;
  const _HubMap({required this.hubs});

  @override
  Widget build(BuildContext context) {
    final markers = hubs.map((h) {
      final size = 14.0 + h.modes.length * 5;
      return Marker(
        point: h.point,
        width: size,
        height: size,
        child: GestureDetector(
          onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => HubDetailScreen(hub: h))),
          child: Tooltip(
            message: h.name,
            child: Container(
              decoration: BoxDecoration(
                color: modeStyle(h.modes.first).color,
                shape: BoxShape.circle,
                border: Border.all(color: Colors.white, width: 2),
                boxShadow: const [BoxShadow(blurRadius: 3, color: Colors.black26)],
              ),
              child: Center(
                child: Text('${h.modes.length}', style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.bold)),
              ),
            ),
          ),
        ),
      );
    }).toList();
    return TransitMap(markers: markers, fitPoints: hubs.map((h) => h.point).toList());
  }
}

class HubDetailScreen extends StatelessWidget {
  final Hub hub;
  const HubDetailScreen({super.key, required this.hub});

  @override
  Widget build(BuildContext context) {
    final h = hub;
    final markers = h.members.map((m) => dotMarker(m.point, modeStyle(m.mode).color, size: 20)).toList();
    final polylines = [
      for (var i = 1; i < h.members.length; i++)
        Polyline(points: [h.members.first.point, h.members[i].point], color: Colors.grey.shade700, strokeWidth: 3, pattern: StrokePattern.dotted()),
    ];
    return Scaffold(
      appBar: AppBar(title: Text(h.name)),
      body: Column(children: [
        SizedBox(
          height: MediaQuery.sizeOf(context).height * 0.35,
          child: TransitMap(markers: markers, polylines: polylines, fitPoints: h.members.length > 1 ? h.members.map((m) => m.point).toList() : [h.point]),
        ),
        Expanded(
          child: ListView(padding: const EdgeInsets.all(16), children: [
            Text(_typeLabels[h.type] ?? h.type, style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
            const SizedBox(height: 4),
            Text('${h.members.length} stops · ${h.lineCount} lines · longest transfer walk ${h.maxWalkM} m (~${h.maxWalkMin.toStringAsFixed(0)} min)'),
            const SizedBox(height: 12),
            ...h.members.map((m) => ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: CircleAvatar(backgroundColor: modeStyle(m.mode).color, child: Icon(modeStyle(m.mode).icon, color: Colors.white, size: 20)),
                  title: Text(m.name),
                  subtitle: Text('${modeStyle(m.mode).label} · ${m.lines.join(', ')}'),
                )),
          ]),
        ),
      ]),
    );
  }
}
