import 'package:flutter/material.dart';

import '../api.dart';
import '../models.dart';
import '../theme.dart';
import '../widgets/state_views.dart';

/// Issued integrated tickets and what each operator receives.
class SettlementScreen extends StatefulWidget {
  const SettlementScreen({super.key});

  @override
  State<SettlementScreen> createState() => _SettlementScreenState();
}

class _SettlementScreenState extends State<SettlementScreen> {
  late Future<Settlement> _future = Api.instance.settlement();

  Future<void> _reload() async {
    final f = Api.instance.settlement();
    setState(() => _future = f);
    await f.then((_) {}, onError: (_) {});
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final text = Theme.of(context).textTheme;
    return Scaffold(
      appBar: AppBar(title: const Text('Fare share')),
      body: FutureBuilder<Settlement>(
        future: _future,
        builder: (context, snap) {
          if (snap.connectionState != ConnectionState.done) return const SkeletonCards(count: 3, label: 'Loading fare share');
          if (snap.hasError) return ErrorView(error: snap.error!, onRetry: _reload);
          final s = snap.data!;
          final maxRevenue = s.operators.fold<double>(1, (m, o) => o.settledRevenue > m ? o.settledRevenue : m);
          Widget stat(String value, String label) => Expanded(
                child: Card(
                  child: Padding(
                    padding: const EdgeInsets.all(Space.m),
                    child: MergeSemantics(
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text(value, style: text.titleLarge),
                        Text(label, style: text.bodySmall?.copyWith(color: scheme.onSurfaceVariant)),
                      ]),
                    ),
                  ),
                ),
              );
          final weights = s.costWeights.entries.map((e) => '${modeStyle(e.key).label} ${e.value}').join(', ');
          return RefreshIndicator(
            onRefresh: _reload,
            child: ListView(padding: const EdgeInsets.all(Space.l), children: [
              Text(
                'One integrated ticket per journey. Revenue from issued tickets is shared between operators by a transparent rule.',
                style: text.bodyMedium?.copyWith(color: scheme.onSurfaceVariant),
              ),
              const SizedBox(height: Space.m),
              IntrinsicHeight(
                child: Row(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                  stat('${s.trips}', 'tickets issued'),
                  const SizedBox(width: Space.s),
                  stat('${s.multimodalTrips}', 'used 2+ operators'),
                ]),
              ),
              const SizedBox(height: Space.s),
              IntrinsicHeight(
                child: Row(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                  stat(rupees(s.integratedRevenue), 'collected'),
                  const SizedBox(width: Space.s),
                  stat(rupees(s.commuterSavings), 'saved by commuters'),
                ]),
              ),
              const SizedBox(height: Space.l),
              const SectionHeader('Settlement per operator'),
              if (s.operators.isEmpty)
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(Space.xl),
                    child: Text(
                      'No tickets issued yet. Operator shares appear here once tickets are booked.',
                      textAlign: TextAlign.center,
                      style: text.bodyMedium?.copyWith(color: scheme.onSurfaceVariant),
                    ),
                  ),
                ),
              ...s.operators.map((o) => Padding(
                    padding: const EdgeInsets.only(bottom: Space.s),
                    child: _OperatorRow(o: o, maxRevenue: maxRevenue),
                  )),
              const SizedBox(height: Space.l),
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(Space.l),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Semantics(header: true, child: Text('How the split works', style: text.titleSmall?.copyWith(fontWeight: FontWeight.w700))),
                    const SizedBox(height: Space.s),
                    Text(
                      '1. Each leg is priced on its operator\'s own fare slabs.\n'
                      '2. Journeys using 2+ operators get a ${s.integrationDiscountPct}% integration discount.\n'
                      '3. ${weights.isEmpty ? 'The integrated fare is split by each operator\'s standalone fare (operating cost weights are not configured yet).' : 'The integrated fare is split ${s.fareWeightPct}% by each operator\'s standalone fare and ${100 - s.fareWeightPct}% by passenger-km weighted by operating cost ($weights).'}',
                      style: text.bodyMedium,
                    ),
                  ]),
                ),
              ),
            ]),
          );
        },
      ),
    );
  }
}

class _OperatorRow extends StatelessWidget {
  final OperatorSettlement o;
  final double maxRevenue;
  const _OperatorRow({required this.o, required this.maxRevenue});

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final text = Theme.of(context).textTheme;
    final color = scheme.primary;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(Space.l),
        child: MergeSemantics(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Container(width: 12, height: 12, decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
              const SizedBox(width: Space.s),
              Expanded(child: Text(o.operatorName, style: text.titleSmall?.copyWith(fontWeight: FontWeight.w700))),
              Text(rupees(o.settledRevenue), style: text.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
            ]),
            const SizedBox(height: Space.s),
            ExcludeSemantics(
              child: ClipRRect(
                borderRadius: BorderRadius.circular(Radii.s),
                child: LinearProgressIndicator(
                  value: o.settledRevenue / maxRevenue,
                  minHeight: 8,
                  color: color,
                  backgroundColor: color.withValues(alpha: 0.15),
                ),
              ),
            ),
            const SizedBox(height: Space.s),
            Text(
              '${o.revenueSharePct.toStringAsFixed(1)}% of revenue · ${plural(o.trips, 'trip')} · ${o.passengerKm.toStringAsFixed(0)} passenger-km · '
              '${o.vsStandalone >= 0 ? '+' : '−'}${rupees(o.vsStandalone.abs())} vs separate tickets',
              style: text.bodySmall?.copyWith(color: scheme.onSurfaceVariant),
            ),
          ]),
        ),
      ),
    );
  }
}
