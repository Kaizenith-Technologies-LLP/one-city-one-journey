import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';

import '../api.dart';
import '../models.dart';
import '../theme.dart';
import '../widgets/mode_chip.dart';
import '../widgets/state_views.dart';
import '../widgets/transit_map.dart';

const _typeLabels = {
  'dual': 'Dual interchange',
  'triple': 'Triple interchange',
  'quad': '4-mode interchange',
  'penta': '5-mode interchange',
};

/// Places where stops of different modes meet.
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
        title: const Text('Interchanges'),
        actions: [
          IconButton(
            tooltip: _showMap ? 'Show as list' : 'Show on map',
            icon: Icon(_showMap ? Icons.view_list_outlined : Icons.map_outlined),
            onPressed: () => setState(() => _showMap = !_showMap),
          ),
        ],
      ),
      body: FutureBuilder<List<Hub>>(
        future: _future,
        builder: (context, snap) {
          if (snap.connectionState != ConnectionState.done) return const SkeletonCards(label: 'Loading interchanges');
          if (snap.hasError) return ErrorView(error: snap.error!, onRetry: () => setState(() => _future = Api.instance.hubs()));
          final all = snap.data!;
          if (all.isEmpty) {
            return const MessageView(
              icon: Icons.hub_outlined,
              title: 'No interchanges found',
              message: 'No stations where different modes meet are in the network data yet.',
            );
          }
          final hubs = all.where((h) => h.modes.length >= _minModes).toList();
          final threePlus = all.where((h) => h.modes.length >= 3).length;
          return Column(children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(Space.l, 0, Space.l, Space.s),
              child: Wrap(spacing: Space.s, children: [
                ChoiceChip(label: Text('All (${all.length})'), selected: _minModes == 2, onSelected: (_) => setState(() => _minModes = 2)),
                ChoiceChip(label: Text('3+ modes ($threePlus)'), selected: _minModes == 3, onSelected: (_) => setState(() => _minModes = 3)),
              ]),
            ),
            Expanded(
              child: hubs.isEmpty
                  ? const MessageView(icon: Icons.hub_outlined, title: 'No interchanges with 3 or more modes')
                  : _showMap
                      ? _HubMap(hubs: hubs)
                      : _HubList(hubs: hubs),
            ),
          ]);
        },
      ),
    );
  }
}

void _openHub(BuildContext context, Hub h) =>
    Navigator.push(context, MaterialPageRoute(builder: (_) => HubDetailScreen(hub: h)));

class _HubList extends StatelessWidget {
  final List<Hub> hubs;
  const _HubList({required this.hubs});

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    final scheme = Theme.of(context).colorScheme;
    return ListView.separated(
      padding: const EdgeInsets.fromLTRB(Space.l, Space.xs, Space.l, Space.l),
      itemCount: hubs.length,
      separatorBuilder: (_, _) => const SizedBox(height: Space.s),
      itemBuilder: (_, i) {
        final h = hubs[i];
        final summary = '${_typeLabels[h.type] ?? h.type} · ${plural(h.lineCount, 'line')} · longest walk ${h.maxWalkM} m';
        return Card(
          child: Semantics(
            button: true,
            label: '${h.name}. ${h.modes.map((m) => modeStyle(m).label).join(', ')}. $summary',
            excludeSemantics: true,
            child: InkWell(
              onTap: () => _openHub(context, h),
              child: Padding(
                padding: const EdgeInsets.all(Space.l),
                child: Row(children: [
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(h.name, style: text.titleMedium),
                      const SizedBox(height: Space.s),
                      Wrap(spacing: Space.xs, runSpacing: Space.xs, children: h.modes.map((m) => ModeChip(mode: m, dense: true)).toList()),
                      const SizedBox(height: Space.s),
                      Text(summary, style: text.bodySmall?.copyWith(color: scheme.onSurfaceVariant)),
                    ]),
                  ),
                  Icon(Icons.chevron_right, color: scheme.onSurfaceVariant),
                ]),
              ),
            ),
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
      final size = 18.0 + h.modes.length * 4;
      final scheme = Theme.of(context).colorScheme;
      return Marker(
        point: h.point,
        width: 48,
        height: 48,
        child: Semantics(
          button: true,
          label: '${h.name}, ${plural(h.modes.length, 'mode')}',
          excludeSemantics: true,
          child: GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTap: () => _openHub(context, h),
            child: Center(
              child: Container(
                width: size,
                height: size,
                decoration: BoxDecoration(
                  color: scheme.primary,
                  shape: BoxShape.circle,
                  border: Border.all(color: AppColors.paper, width: 2),
                  boxShadow: [BoxShadow(blurRadius: 3, color: AppColors.ink.withValues(alpha: 0.3))],
                ),
                child: Center(
                  child: Text('${h.modes.length}', style: TextStyle(color: scheme.onPrimary, fontSize: 11, fontWeight: FontWeight.bold)),
                ),
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
    final text = Theme.of(context).textTheme;
    final scheme = Theme.of(context).colorScheme;
    final markers = h.members.map((m) => dotMarker(m.point, AppColors.primary, size: 20)).toList();
    final polylines = [
      for (var i = 1; i < h.members.length; i++)
        Polyline(points: [h.members.first.point, h.members[i].point], color: AppColors.neutral, strokeWidth: 3, pattern: StrokePattern.dashed(segments: const [8, 6])),
    ];
    return Scaffold(
      appBar: AppBar(title: Text(h.name)),
      body: Column(children: [
        SizedBox(
          height: MediaQuery.sizeOf(context).height * 0.3,
          child: TransitMap(
            markers: markers,
            polylines: polylines,
            fitPoints: h.members.length > 1 ? h.members.map((m) => m.point).toList() : [h.point],
          ),
        ),
        Expanded(
          child: ListView(padding: const EdgeInsets.all(Space.l), children: [
            Semantics(header: true, child: Text(_typeLabels[h.type] ?? h.type, style: text.titleMedium)),
            const SizedBox(height: Space.xs),
            Text(
              '${plural(h.members.length, 'stop')} · ${plural(h.lineCount, 'line')} · '
              'longest transfer walk ${h.maxWalkM} m (about ${h.maxWalkMin.toStringAsFixed(0)} min)',
              style: text.bodyMedium?.copyWith(color: scheme.onSurfaceVariant),
            ),
            const SizedBox(height: Space.m),
            Card(
              child: Column(
                children: h.members.map((m) {
                  final st = modeStyle(m.mode);
                  return ListTile(
                    leading: CircleAvatar(backgroundColor: scheme.secondaryContainer, child: Icon(st.icon, color: scheme.onSecondaryContainer, size: 20)),
                    title: Text(m.name),
                    subtitle: Text(m.lines.isEmpty ? st.label : '${st.label} · ${m.lines.join(', ')}'),
                  );
                }).toList(),
              ),
            ),
          ]),
        ),
      ]),
    );
  }
}
