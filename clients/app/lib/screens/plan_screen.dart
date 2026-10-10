import 'package:flutter/material.dart';

import '../api.dart';
import '../models.dart';
import '../store.dart';
import '../theme.dart';
import '../widgets/depart_chip.dart';
import '../widgets/heat_note.dart';
import '../widgets/state_views.dart';
import 'alerts_screen.dart';
import 'results_screen.dart';
import 'stop_search_screen.dart';

/// Home: where to, from where, when, then straight to results.
class PlanScreen extends StatefulWidget {
  const PlanScreen({super.key});

  @override
  State<PlanScreen> createState() => _PlanScreenState();
}

class _PlanScreenState extends State<PlanScreen> {
  Place? _from;
  Place? _to;
  String? _depart;
  late Future<List<Disruption>> _alerts = Api.instance.closures();
  late final Future<WeatherNow> _weather = Api.instance.weather();

  Future<Place?> _search(bool isFrom) => Navigator.push<Place>(
        context,
        MaterialPageRoute(
          builder: (_) => StopSearchScreen(
            title: isFrom ? 'Start from' : 'Where to?',
            hint: isFrom ? 'Search your starting stop' : 'Search a station or bus stop',
          ),
        ),
      );

  Future<void> _pickTo() async {
    final p = await _search(false);
    if (p == null || !mounted) return;
    setState(() => _to = p);
    if (_from == null) {
      await _pickFrom();
    } else {
      _go();
    }
  }

  Future<void> _pickFrom() async {
    final p = await _search(true);
    if (p == null || !mounted) return;
    setState(() => _from = p);
    if (_to != null) _go();
  }

  void _swap() => setState(() {
        final t = _from;
        _from = _to;
        _to = t;
      });

  void _go() {
    if (_from == null || _to == null) return;
    if (_from!.sameAs(_to!)) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Start and destination are the same. Choose a different stop.')));
      return;
    }
    _open(TripRequest(_from!, _to!, depart: _depart));
  }

  void _open(TripRequest trip) {
    AppStore.instance.recentTrips.add(trip);
    Navigator.push(context, MaterialPageRoute(builder: (_) => ResultsScreen(trip: trip)));
  }

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    final scheme = Theme.of(context).colorScheme;
    return Scaffold(
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: () async {
            final f = Api.instance.closures();
            setState(() => _alerts = f);
            await f.then((_) {}, onError: (_) {});
          },
          child: ListView(padding: const EdgeInsets.fromLTRB(Space.l, Space.l, Space.l, Space.xl), children: [
            Semantics(
              header: true,
              child: Text('One City, One Journey', style: text.labelLarge?.copyWith(color: scheme.primary)),
            ),
            const SizedBox(height: Space.xs),
            Text('Metro · BRTS · AMTS · GSRTC · GMC bus, one ticket',
                style: text.bodySmall?.copyWith(color: scheme.onSurfaceVariant)),
            const SizedBox(height: Space.l),
            _SearchCard(
              from: _from,
              to: _to,
              depart: _depart,
              onFrom: _pickFrom,
              onTo: _pickTo,
              onSwap: _swap,
              onDepart: (v) => setState(() => _depart = v),
              onGo: _from != null && _to != null ? _go : null,
            ),
            const SizedBox(height: Space.m),
            _WeatherNote(future: _weather),
            _AlertsEntry(future: _alerts, onRetry: () => setState(() => _alerts = Api.instance.closures())),
            const SizedBox(height: Space.l),
            ListenableBuilder(
              listenable: AppStore.instance.recentTrips,
              builder: (context, _) {
                final trips = AppStore.instance.recentTrips.items;
                return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                  SectionHeader(
                    'Recent searches',
                    trailing: trips.isEmpty
                        ? null
                        : TextButton(onPressed: AppStore.instance.recentTrips.clear, child: const Text('Clear')),
                  ),
                  if (trips.isEmpty)
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: Space.l),
                      child: Text(
                        'Trips you search for appear here for one-tap planning.',
                        style: text.bodyMedium?.copyWith(color: scheme.onSurfaceVariant),
                      ),
                    )
                  else
                    Card(
                      child: Column(children: [
                        for (var i = 0; i < trips.length; i++) ...[
                          if (i > 0) const Divider(height: 1, indent: 56),
                          ListTile(
                            leading: const Icon(Icons.history),
                            title: Text(trips[i].to.label, maxLines: 2, overflow: TextOverflow.ellipsis),
                            subtitle: Text('from ${trips[i].from.label}', maxLines: 2, overflow: TextOverflow.ellipsis),
                            trailing: IconButton(
                              tooltip: 'Plan the return trip',
                              icon: const Icon(Icons.swap_horiz),
                              onPressed: () => _open(trips[i].swapped().withDepart(_depart)),
                            ),
                            onTap: () {
                              setState(() {
                                _from = trips[i].from;
                                _to = trips[i].to;
                              });
                              _open(trips[i].withDepart(_depart));
                            },
                          ),
                        ],
                      ]),
                    ),
                ]);
              },
            ),
          ]),
        ),
      ),
    );
  }
}

class _SearchCard extends StatelessWidget {
  final Place? from;
  final Place? to;
  final String? depart;
  final VoidCallback onFrom;
  final VoidCallback onTo;
  final VoidCallback onSwap;
  final ValueChanged<String?> onDepart;
  final VoidCallback? onGo;

  const _SearchCard({
    required this.from,
    required this.to,
    required this.depart,
    required this.onFrom,
    required this.onTo,
    required this.onSwap,
    required this.onDepart,
    required this.onGo,
  });

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final text = Theme.of(context).textTheme;
    return Card(
      color: scheme.surfaceContainer,
      child: Padding(
        padding: const EdgeInsets.all(Space.m),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Material(
            color: scheme.primaryContainer,
            borderRadius: BorderRadius.circular(Radii.l),
            child: InkWell(
              borderRadius: BorderRadius.circular(Radii.l),
              onTap: onTo,
              child: Semantics(
                button: true,
                label: to == null ? 'Where to? Search destination' : 'Destination: ${to!.label}. Change destination',
                excludeSemantics: true,
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: Space.l, vertical: Space.l),
                  child: Row(children: [
                    Icon(Icons.search, color: scheme.onPrimaryContainer, size: 28),
                    const SizedBox(width: Space.m),
                    Expanded(
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        if (to != null) Text('To', style: text.labelMedium?.copyWith(color: scheme.onPrimaryContainer)),
                        Text(
                          to?.label ?? 'Where to?',
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: text.titleLarge?.copyWith(color: scheme.onPrimaryContainer),
                        ),
                      ]),
                    ),
                    if (to != null) const Icon(Icons.place, color: endColor),
                  ]),
                ),
              ),
            ),
          ),
          const SizedBox(height: Space.s),
          Row(children: [
            Expanded(
              child: Material(
                color: scheme.surfaceContainerHighest,
                borderRadius: BorderRadius.circular(Radii.m),
                child: InkWell(
                  borderRadius: BorderRadius.circular(Radii.m),
                  onTap: onFrom,
                  child: Semantics(
                    button: true,
                    label: from == null ? 'From: choose a start stop or point on the map' : 'From: ${from!.label}. Change start',
                    excludeSemantics: true,
                    child: ConstrainedBox(
                      constraints: const BoxConstraints(minHeight: 56),
                      child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: Space.m, vertical: Space.s),
                        child: Row(children: [
                          const Icon(Icons.trip_origin, color: startColor, size: 20),
                          const SizedBox(width: Space.m),
                          Expanded(
                            child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
                              Text('From', style: text.labelMedium?.copyWith(color: scheme.onSurfaceVariant)),
                              Text(
                                from?.label ?? 'Choose a stop or point on map',
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                                style: text.bodyLarge?.copyWith(
                                  color: from == null ? scheme.onSurfaceVariant : scheme.onSurface,
                                  fontWeight: from == null ? null : FontWeight.w600,
                                ),
                              ),
                            ]),
                          ),
                        ]),
                      ),
                    ),
                  ),
                ),
              ),
            ),
            const SizedBox(width: Space.xs),
            IconButton.filledTonal(
              tooltip: 'Swap start and destination',
              onPressed: from == null && to == null ? null : onSwap,
              icon: const Icon(Icons.swap_vert),
            ),
          ]),
          const SizedBox(height: Space.m),
          Wrap(
            spacing: Space.s,
            runSpacing: Space.s,
            alignment: WrapAlignment.spaceBetween,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              DepartChip(depart: depart, onChanged: onDepart),
              FilledButton.icon(onPressed: onGo, icon: const Icon(Icons.alt_route), label: const Text('Find routes')),
            ],
          ),
        ]),
      ),
    );
  }
}

class _AlertsEntry extends StatelessWidget {
  final Future<List<Disruption>> future;
  final VoidCallback onRetry;
  const _AlertsEntry({required this.future, required this.onRetry});

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return FutureBuilder<List<Disruption>>(
      future: future,
      builder: (context, snap) {
        final loading = snap.connectionState != ConnectionState.done;
        final list = snap.data ?? const <Disruption>[];
        final active = list.where((d) => d.isActive).length;
        final String subtitle;
        if (loading) {
          subtitle = 'Checking for closures…';
        } else if (snap.hasError) {
          subtitle = 'Couldn\'t load alerts. Tap to try again.';
        } else if (list.isEmpty) {
          subtitle = 'All services running as planned';
        } else {
          subtitle = [if (active > 0) '$active in effect now', if (list.length > active) '${list.length - active} upcoming'].join(' · ');
        }
        final warn = list.isNotEmpty;
        return Card(
          child: ListTile(
            leading: Badge(
              isLabelVisible: list.isNotEmpty,
              label: Text('${list.length}'),
              child: Icon(
                warn ? Icons.warning_amber_rounded : Icons.check_circle_outline,
                color: warn ? warningColor(context) : successColor(context),
              ),
            ),
            title: const Text('Service alerts'),
            subtitle: Text(subtitle),
            trailing: loading
                ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2))
                : Icon(Icons.chevron_right, color: scheme.onSurfaceVariant),
            onTap: loading
                ? null
                : snap.hasError
                    ? onRetry
                    : () => Navigator.push(context, MaterialPageRoute(builder: (_) => AlertsScreen(initial: list))),
          ),
        );
      },
    );
  }
}

class _WeatherNote extends StatelessWidget {
  final Future<WeatherNow> future;
  const _WeatherNote({required this.future});

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<WeatherNow>(
      future: future,
      builder: (context, snap) {
        final w = snap.data?.now;
        final threshold = snap.data?.thresholdC;
        if (w == null || !(w.heatMode || (threshold != null && w.feelsLikeC >= threshold))) return const SizedBox.shrink();
        return Padding(
          padding: const EdgeInsets.only(bottom: Space.m),
          child: HeatNote(weather: w),
        );
      },
    );
  }
}
