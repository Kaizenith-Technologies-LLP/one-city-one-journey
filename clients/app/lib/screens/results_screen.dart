import 'package:flutter/material.dart';

import '../api.dart';
import '../models.dart';
import '../theme.dart';
import '../widgets/mode_chip.dart';
import 'journey_screen.dart';

enum SortBy { best, fastest, cheapest, leastWalking }

class ResultsScreen extends StatefulWidget {
  final Place from;
  final Place to;
  const ResultsScreen({super.key, required this.from, required this.to});

  @override
  State<ResultsScreen> createState() => _ResultsScreenState();
}

class _ResultsScreenState extends State<ResultsScreen> {
  late Future<PlanResult> _future = Api.instance.plan(widget.from, widget.to);
  SortBy _sort = SortBy.best;

  List<JourneyOption> _sorted(List<JourneyOption> options) {
    final list = [...options];
    int byTime(JourneyOption a, JourneyOption b) => a.totalMin.compareTo(b.totalMin);
    switch (_sort) {
      case SortBy.best:
        break;
      case SortBy.fastest:
        list.sort(byTime);
      case SortBy.cheapest:
        list.sort((a, b) => a.fare.compareTo(b.fare) != 0 ? a.fare.compareTo(b.fare) : byTime(a, b));
      case SortBy.leastWalking:
        list.sort((a, b) => a.walkM.compareTo(b.walkM) != 0 ? a.walkM.compareTo(b.walkM) : byTime(a, b));
    }
    return list;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(widget.from.label, style: const TextStyle(fontSize: 15), overflow: TextOverflow.ellipsis),
          Text('to ${widget.to.label}', style: const TextStyle(fontSize: 13), overflow: TextOverflow.ellipsis),
        ]),
      ),
      body: FutureBuilder<PlanResult>(
        future: _future,
        builder: (context, snap) {
          if (snap.connectionState != ConnectionState.done) return const Center(child: CircularProgressIndicator());
          if (snap.hasError) {
            return _Message(
              icon: Icons.cloud_off,
              text: snap.error.toString(),
              action: FilledButton(
                onPressed: () => setState(() => _future = Api.instance.plan(widget.from, widget.to)),
                child: const Text('Retry'),
              ),
            );
          }
          final options = _sorted(snap.data!.options);
          if (options.isEmpty) return const _Message(icon: Icons.route, text: 'No transit route found between these places.');
          return Column(children: [
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.fromLTRB(12, 8, 12, 4),
              child: Row(
                children: SortBy.values
                    .map((s) => Padding(
                          padding: const EdgeInsets.only(right: 8),
                          child: ChoiceChip(
                            label: Text(switch (s) {
                              SortBy.best => 'Recommended',
                              SortBy.fastest => 'Fastest',
                              SortBy.cheapest => 'Cheapest',
                              SortBy.leastWalking => 'Least walking',
                            }),
                            selected: _sort == s,
                            onSelected: (_) => setState(() => _sort = s),
                          ),
                        ))
                    .toList(),
              ),
            ),
            Expanded(
              child: ListView.separated(
                padding: const EdgeInsets.all(12),
                itemCount: options.length,
                separatorBuilder: (_, _) => const SizedBox(height: 10),
                itemBuilder: (_, i) => RouteCard(
                  option: options[i],
                  onTap: () => Navigator.push(
                    context,
                    MaterialPageRoute(builder: (_) => JourneyScreen(option: options[i], from: widget.from, to: widget.to)),
                  ),
                ),
              ),
            ),
          ]);
        },
      ),
    );
  }
}

class RouteCard extends StatelessWidget {
  final JourneyOption option;
  final VoidCallback onTap;
  const RouteCard({super.key, required this.option, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final text = Theme.of(context).textTheme;
    final o = option;
    return Card(
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            if (o.tags.isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Wrap(
                  spacing: 6,
                  children: o.tags
                      .map((t) => Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                            decoration: BoxDecoration(color: scheme.primaryContainer, borderRadius: BorderRadius.circular(20)),
                            child: Text(tagLabels[t] ?? t,
                                style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: scheme.onPrimaryContainer)),
                          ))
                      .toList(),
                ),
              ),
            Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
              Text(formatMin(o.totalMin), style: text.headlineSmall?.copyWith(fontWeight: FontWeight.w700)),
              const Spacer(),
              Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text(rupees(o.fare), style: text.titleLarge?.copyWith(fontWeight: FontWeight.w700, color: scheme.primary)),
                if (o.standaloneFare > o.fare)
                  Text(rupees(o.standaloneFare),
                      style: text.bodySmall?.copyWith(decoration: TextDecoration.lineThrough, color: scheme.onSurfaceVariant)),
              ]),
            ]),
            const SizedBox(height: 10),
            LegSequence(legs: o.legs),
            const SizedBox(height: 10),
            DefaultTextStyle(
              style: text.bodySmall!.copyWith(color: scheme.onSurfaceVariant),
              child: Wrap(spacing: 14, runSpacing: 4, children: [
                _Stat(Icons.directions_walk, formatDistance(o.walkM)),
                _Stat(Icons.sync_alt, o.transfers == 0 ? 'Direct' : '${o.transfers} change${o.transfers == 1 ? '' : 's'}'),
                _Stat(Icons.schedule, '${o.waitMin} min wait'),
                _Stat(Icons.straighten, '${o.distanceKm.toStringAsFixed(1)} km'),
              ]),
            ),
          ]),
        ),
      ),
    );
  }
}

class _Stat extends StatelessWidget {
  final IconData icon;
  final String text;
  const _Stat(this.icon, this.text);

  @override
  Widget build(BuildContext context) =>
      Row(mainAxisSize: MainAxisSize.min, children: [Icon(icon, size: 14), const SizedBox(width: 3), Text(text)]);
}

class _Message extends StatelessWidget {
  final IconData icon;
  final String text;
  final Widget? action;
  const _Message({required this.icon, required this.text, this.action});

  @override
  Widget build(BuildContext context) => Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            Icon(icon, size: 48, color: Theme.of(context).colorScheme.outline),
            const SizedBox(height: 12),
            Text(text, textAlign: TextAlign.center),
            if (action != null) ...[const SizedBox(height: 16), action!],
          ]),
        ),
      );
}
