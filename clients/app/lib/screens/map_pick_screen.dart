import 'dart:async';

import 'package:flutter/material.dart';
import 'package:latlong2/latlong.dart';

import '../api.dart';
import '../models.dart';
import '../theme.dart';
import '../widgets/transit_map.dart';

/// Move the map under a fixed centre pin, then confirm. Pops with a [Place].
class MapPickScreen extends StatefulWidget {
  final String title;
  const MapPickScreen({super.key, required this.title});

  @override
  State<MapPickScreen> createState() => _MapPickScreenState();
}

class _MapPickScreenState extends State<MapPickScreen> {
  LatLng _center = regionCenter;
  Stop? _nearest;
  bool _looking = false;
  Timer? _debounce;
  int _requestId = 0;

  @override
  void initState() {
    super.initState();
    _lookup();
  }

  @override
  void dispose() {
    _debounce?.cancel();
    super.dispose();
  }

  void _onMoved(LatLng center, bool byUser) {
    _center = center;
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 400), _lookup);
  }

  Future<void> _lookup() async {
    final id = ++_requestId;
    setState(() => _looking = true);
    Stop? nearest;
    try {
      final r = await Api.instance.nearestStops(_center.latitude, _center.longitude, limit: 1);
      nearest = r.isEmpty ? null : r.first;
    } catch (_) {
      nearest = null;
    }
    if (!mounted || id != _requestId) return;
    setState(() {
      _nearest = nearest;
      _looking = false;
    });
  }

  String get _label => _nearest == null ? 'Pinned location' : 'Near ${_nearest!.name}';

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final text = Theme.of(context).textTheme;
    return Scaffold(
      appBar: AppBar(title: Text(widget.title)),
      body: Stack(children: [
        Positioned.fill(child: TransitMap(onMoved: _onMoved)),
        IgnorePointer(
          child: Center(
            child: Padding(
              padding: const EdgeInsets.only(bottom: 44),
              child: Icon(Icons.place, size: 44, color: endColor, shadows: [Shadow(blurRadius: 6, color: AppColors.ink.withValues(alpha: 0.5))]),
            ),
          ),
        ),
      ]),
      bottomNavigationBar: Material(
        color: scheme.surfaceContainer,
        child: SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(Space.l),
            child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              Semantics(
                liveRegion: true,
                child: Row(children: [
                  Icon(Icons.place_outlined, color: scheme.onSurfaceVariant),
                  const SizedBox(width: Space.s),
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(_looking ? 'Finding nearest stop…' : _label, style: text.titleMedium),
                      Text(
                        _nearest?.distanceM != null
                            ? '${formatDistance(_nearest!.distanceM!)} from ${_nearest!.name} (${modeStyle(_nearest!.mode).label})'
                            : 'Move the map to place the pin',
                        style: text.bodySmall?.copyWith(color: scheme.onSurfaceVariant),
                      ),
                    ]),
                  ),
                ]),
              ),
              const SizedBox(height: Space.m),
              FilledButton.icon(
                onPressed: () => Navigator.pop(context, Place(label: _label, point: _center)),
                icon: const Icon(Icons.check),
                label: const Text('Use this point'),
              ),
            ]),
          ),
        ),
      ),
    );
  }
}
