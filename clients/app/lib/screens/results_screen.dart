import 'package:flutter/material.dart';

import '../api.dart';
import '../models.dart';
import '../store.dart';
import '../theme.dart';
import '../widgets/booking_sheet.dart';
import '../widgets/depart_chip.dart';
import '../widgets/disruption_card.dart';
import '../widgets/heat_note.dart';
import '../widgets/mode_chip.dart';
import '../widgets/route_card.dart';
import '../widgets/state_views.dart';
import 'journey_screen.dart';

enum _Filter { recommended, fastest, fewestTransfers, leastWalking, cheapest }

extension on _Filter {
  String get label => tagLabels[name]!;
}

class ResultsScreen extends StatefulWidget {
  final TripRequest trip;
  const ResultsScreen({super.key, required this.trip});

  @override
  State<ResultsScreen> createState() => _ResultsScreenState();
}

class _ResultsScreenState extends State<ResultsScreen> {
  late TripRequest _trip = widget.trip;
  late Future<PlanResult> _future = Api.instance.plan(_trip);
  _Filter _filter = _Filter.recommended;
  final Set<String> _dismissed = {};

  void _reload([TripRequest? trip]) => setState(() {
        if (trip != null) _trip = trip;
        _future = Api.instance.plan(_trip);
      });

  void _swap() {
    final t = _trip.swapped();
    AppStore.instance.recentTrips.add(t);
    _reload(t);
  }

  Future<void> _changeTime() async {
    final choice = await pickDeparture(context, _trip.depart);
    if (choice != null) _reload(_trip.withDepart(choice.value));
  }

  List<JourneyOption> _sorted(PlanResult r) {
    final base = clockToMin(r.departAt) ?? 0;
    int rel(String t) => ((clockToMin(t) ?? base) - base + 1440) % 1440;
    int arrive(JourneyOption a, JourneyOption b) => rel(a.arriveTime).compareTo(rel(b.arriveTime));
    final list = [...r.options];
    switch (_filter) {
      case _Filter.recommended:
        break;
      case _Filter.fastest:
        list.sort((a, b) => arrive(a, b) != 0 ? arrive(a, b) : a.totalMin.compareTo(b.totalMin));
      case _Filter.fewestTransfers:
        list.sort((a, b) => a.transfers != b.transfers ? a.transfers.compareTo(b.transfers) : arrive(a, b));
      case _Filter.leastWalking:
        list.sort((a, b) => a.walkM != b.walkM ? a.walkM.compareTo(b.walkM) : arrive(a, b));
      case _Filter.cheapest:
        list.sort((a, b) => a.fare != b.fare ? a.fare.compareTo(b.fare) : arrive(a, b));
    }
    return list;
  }

  void _openJourney(PlanResult r, JourneyOption o) => Navigator.push(
        context,
        MaterialPageRoute(builder: (_) => JourneyScreen(trip: _trip, option: o, departAt: r.departAt)),
      );

  void _book(PlanResult r, JourneyOption o) => startBooking(context, trip: _trip, option: o, departAt: r.departAt);

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    final scheme = Theme.of(context).colorScheme;
    return Scaffold(
      appBar: AppBar(
        titleSpacing: 0,
        title: Semantics(
          label: 'Routes from ${_trip.from.label} to ${_trip.to.label}',
          excludeSemantics: true,
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(_trip.from.label, style: text.titleMedium, overflow: TextOverflow.ellipsis),
            Text('to ${_trip.to.label}', style: text.bodyMedium?.copyWith(color: scheme.onSurfaceVariant), overflow: TextOverflow.ellipsis),
          ]),
        ),
        actions: [IconButton(tooltip: 'Reverse trip', icon: const Icon(Icons.swap_vert), onPressed: _swap)],
      ),
      body: FutureBuilder<PlanResult>(
        future: _future,
        builder: (context, snap) {
          final header = Padding(
            padding: const EdgeInsets.fromLTRB(Space.l, 0, Space.l, Space.xs),
            child: Row(children: [
              DepartChip(depart: _trip.depart, onChanged: (v) => _reload(_trip.withDepart(v))),
              const SizedBox(width: Space.s),
              if (snap.hasData)
                Expanded(
                  child: Text(
                    'Planned for ${snap.data!.departAt}',
                    style: text.bodySmall?.copyWith(color: scheme.onSurfaceVariant),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
            ]),
          );
          if (snap.connectionState != ConnectionState.done) {
            return Column(children: [
              header,
              const Expanded(child: SkeletonCards(label: 'Finding routes')),
            ]);
          }
          if (snap.hasError) {
            return Column(children: [header, Expanded(child: ErrorView(error: snap.error!, onRetry: _reload))]);
          }
          final r = snap.data!;
          final alerts = r.disruptions.where((d) => !_dismissed.contains(d.id)).toList();
          final notices = <Widget>[
            if (r.weather?.heatMode == true) HeatNote(weather: r.weather!),
            ...alerts.map((d) => DisruptionCard(
                  key: ValueKey(d.id),
                  disruption: d,
                  onDismiss: () => setState(() => _dismissed.add(d.id)),
                )),
          ];
          if (r.options.isEmpty) {
            return Column(children: [
              header,
              Expanded(child: _NoRoute(result: r, notices: notices, onChangeTime: _changeTime)),
            ]);
          }
          final options = _sorted(r);
          final top = options.first;
          final featured = _filter == _Filter.recommended ? top.isRecommended : top.tags.contains(_filter.name);
          return Column(children: [
            header,
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: Space.l),
              child: Row(
                children: _Filter.values
                    .map((f) => Padding(
                          padding: const EdgeInsets.only(right: Space.s),
                          child: ChoiceChip(
                            label: Text(f.label),
                            selected: _filter == f,
                            onSelected: (_) => setState(() => _filter = f),
                          ),
                        ))
                    .toList(),
              ),
            ),
            Expanded(
              child: RefreshIndicator(
                onRefresh: () async {
                  _reload();
                  await _future.then((_) {}, onError: (_) {});
                },
                child: ListView(padding: const EdgeInsets.fromLTRB(Space.l, Space.s, Space.l, Space.xl), children: [
                  for (final n in notices) Padding(padding: const EdgeInsets.only(bottom: Space.m), child: n),
                  Semantics(
                    liveRegion: true,
                    child: Padding(
                      padding: const EdgeInsets.only(bottom: Space.s),
                      child: Text(
                        '${plural(options.length, 'route')} found${_filter == _Filter.recommended ? '' : ' · sorted by ${_filter.label.toLowerCase()}'}',
                        style: text.bodySmall?.copyWith(color: scheme.onSurfaceVariant),
                      ),
                    ),
                  ),
                  for (var i = 0; i < options.length; i++)
                    Padding(
                      padding: const EdgeInsets.only(bottom: Space.m),
                      child: RouteCard(
                        option: options[i],
                        featured: i == 0 && featured,
                        featuredLabel: i == 0 && featured ? _filter.label : null,
                        onOpen: () => _openJourney(r, options[i]),
                        onBook: () => _book(r, options[i]),
                      ),
                    ),
                  if (r.notRunning.isNotEmpty) _NotRunningTile(result: r),
                ]),
              ),
            ),
          ]);
        },
      ),
    );
  }
}

class _NoRoute extends StatelessWidget {
  final PlanResult result;
  final List<Widget> notices;
  final VoidCallback onChangeTime;
  const _NoRoute({required this.result, required this.notices, required this.onChangeTime});

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    final scheme = Theme.of(context).colorScheme;
    final r = result;
    final when = r.departAt.isEmpty ? 'right now' : 'at ${r.departAt}';
    return ListView(padding: const EdgeInsets.all(Space.l), children: [
      for (final n in notices) Padding(padding: const EdgeInsets.only(bottom: Space.m), child: n),
      const SizedBox(height: Space.l),
      Center(
        child: Container(
          padding: const EdgeInsets.all(Space.l),
          decoration: BoxDecoration(color: scheme.surfaceContainerHighest, shape: BoxShape.circle),
          child: Icon(Icons.route_outlined, size: 36, color: scheme.onSurfaceVariant),
        ),
      ),
      const SizedBox(height: Space.l),
      Semantics(header: true, child: Text('No route $when', textAlign: TextAlign.center, style: text.titleLarge)),
      const SizedBox(height: Space.s),
      Text(
        r.notRunning.isNotEmpty
            ? 'No scheduled service connects these places $when. Some lines have finished or not started yet, listed below.'
            : 'No scheduled service connects these places $when. Timetables are available for only some lines so far.',
        textAlign: TextAlign.center,
        style: text.bodyMedium?.copyWith(color: scheme.onSurfaceVariant),
      ),
      const SizedBox(height: Space.xl),
      Wrap(alignment: WrapAlignment.center, spacing: Space.s, runSpacing: Space.s, children: [
        FilledButton.icon(onPressed: onChangeTime, icon: const Icon(Icons.schedule), label: const Text('Try another time')),
        OutlinedButton.icon(
          onPressed: () => Navigator.pop(context),
          icon: const Icon(Icons.edit_location_alt_outlined),
          label: const Text('Change stops'),
        ),
      ]),
      if (r.notRunning.isNotEmpty) ...[
        const SizedBox(height: Space.xl),
        SectionHeader('Not running $when'),
        Card(child: Column(children: _notRunningRows(r.notRunning))),
      ],
    ]);
  }
}

class _NotRunningTile extends StatelessWidget {
  final PlanResult result;
  const _NotRunningTile({required this.result});

  @override
  Widget build(BuildContext context) {
    return Card(
      child: ExpansionTile(
        shape: const Border(),
        leading: Icon(Icons.info_outline, color: warningColor(context)),
        title: Text('${plural(result.notRunning.length, 'line')} not running at ${result.departAt}'),
        subtitle: const Text('Why some services are missing'),
        children: _notRunningRows(result.notRunning),
      ),
    );
  }
}

List<Widget> _notRunningRows(List<NotRunningLine> lines) {
  const order = {'ended': 0, 'notStarted': 1, 'noServiceToday': 2};
  final sorted = [...lines]..sort((a, b) => (order[a.status] ?? 3).compareTo(order[b.status] ?? 3));
  return sorted
      .map((l) => ListTile(
            leading: ModeChip(mode: l.mode, dense: true),
            title: Text(l.name),
            subtitle: Text(l.explanation),
          ))
      .toList();
}
