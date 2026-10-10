import 'package:flutter/material.dart';
import 'package:latlong2/latlong.dart';

import '../api.dart';
import '../models.dart';
import '../theme.dart';
import '../widgets/transit_map.dart';
import 'results_screen.dart';
import 'stop_search_screen.dart';

class PlanScreen extends StatefulWidget {
  const PlanScreen({super.key});

  @override
  State<PlanScreen> createState() => _PlanScreenState();
}

class _PlanScreenState extends State<PlanScreen> {
  Place? _from;
  Place? _to;

  Future<void> _pick(bool isFrom) async {
    final stop = await Navigator.push<Stop>(
      context,
      MaterialPageRoute(builder: (_) => StopSearchScreen(title: isFrom ? 'Start from' : 'Going to')),
    );
    if (stop == null) return;
    setState(() => isFrom ? _from = Place.fromStop(stop) : _to = Place.fromStop(stop));
  }

  Future<void> _onMapTap(LatLng p) async {
    String label = 'Pinned location';
    try {
      final near = await Api.instance.nearestStops(p.latitude, p.longitude, limit: 1);
      if (near.isNotEmpty) label = 'Near ${near.first.name}';
    } catch (_) {}
    if (!mounted) return;
    final choice = await showModalBottomSheet<bool>(
      context: context,
      showDragHandle: true,
      builder: (ctx) => SafeArea(
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          ListTile(title: Text(label), subtitle: Text('${p.latitude.toStringAsFixed(5)}, ${p.longitude.toStringAsFixed(5)}')),
          ListTile(
            leading: const Icon(Icons.trip_origin, color: Colors.green),
            title: const Text('Set as start'),
            onTap: () => Navigator.pop(ctx, true),
          ),
          ListTile(
            leading: const Icon(Icons.place, color: Colors.red),
            title: const Text('Set as destination'),
            onTap: () => Navigator.pop(ctx, false),
          ),
        ]),
      ),
    );
    if (choice == null) return;
    final place = Place(label: label, point: p);
    setState(() => choice ? _from = place : _to = place);
  }

  void _swap() => setState(() {
        final t = _from;
        _from = _to;
        _to = t;
      });

  void _plan() {
    if (_from == null || _to == null) return;
    Navigator.push(context, MaterialPageRoute(builder: (_) => ResultsScreen(from: _from!, to: _to!)));
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final markers = [
      if (_from != null) pinMarker(_from!.point, Colors.green.shade700, Icons.trip_origin),
      if (_to != null) pinMarker(_to!.point, Colors.red.shade700, Icons.place),
    ];
    return Stack(children: [
      Positioned.fill(
        child: TransitMap(
          key: ValueKey('${_from?.query}-${_to?.query}'),
          markers: markers,
          fitPoints: [?_from?.point, ?_to?.point],
          onTap: _onMapTap,
        ),
      ),
      SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Card(
            elevation: 4,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 14, 8, 14),
              child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                Text('One City, One Journey',
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
                Text('Metro · BRTS · AMTS · GSRTC across Ahmedabad & Gandhinagar',
                    style: TextStyle(fontSize: 12, color: scheme.onSurfaceVariant)),
                const SizedBox(height: 12),
                Row(children: [
                  Expanded(
                    child: Column(children: [
                      _PlaceField(place: _from, hint: 'Start: stop or tap the map', icon: Icons.trip_origin, iconColor: Colors.green.shade700, onTap: () => _pick(true)),
                      const SizedBox(height: 8),
                      _PlaceField(place: _to, hint: 'Destination', icon: Icons.place, iconColor: Colors.red.shade700, onTap: () => _pick(false)),
                    ]),
                  ),
                  IconButton(onPressed: _swap, icon: const Icon(Icons.swap_vert), tooltip: 'Swap'),
                ]),
                const SizedBox(height: 12),
                Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: FilledButton.icon(
                    onPressed: _from != null && _to != null ? _plan : null,
                    icon: const Icon(Icons.alt_route),
                    label: const Text('Find routes'),
                  ),
                ),
              ]),
            ),
          ),
        ),
      ),
    ]);
  }
}

class _PlaceField extends StatelessWidget {
  final Place? place;
  final String hint;
  final IconData icon;
  final Color iconColor;
  final VoidCallback onTap;

  const _PlaceField({required this.place, required this.hint, required this.icon, required this.iconColor, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Material(
      color: scheme.surfaceContainerHighest.withValues(alpha: 0.6),
      borderRadius: BorderRadius.circular(12),
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
          child: Row(children: [
            Icon(icon, color: iconColor, size: 20),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                place?.label ?? hint,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(color: place == null ? scheme.onSurfaceVariant : scheme.onSurface),
              ),
            ),
            if (place?.mode != null)
              Text(modeStyle(place!.mode).label, style: TextStyle(fontSize: 11, color: modeStyle(place!.mode).color, fontWeight: FontWeight.w600)),
          ]),
        ),
      ),
    );
  }
}
