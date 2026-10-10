import 'package:flutter/material.dart';

import '../api.dart';
import '../models.dart';
import '../theme.dart';

/// Issued integrated tickets and what each operator receives.
class SettlementScreen extends StatefulWidget {
  const SettlementScreen({super.key});

  @override
  State<SettlementScreen> createState() => _SettlementScreenState();
}

class _SettlementScreenState extends State<SettlementScreen> {
  late Future<Settlement> _future = Api.instance.settlement();

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final text = Theme.of(context).textTheme;
    return Scaffold(
      appBar: AppBar(title: const Text('Fare sharing')),
      body: FutureBuilder<Settlement>(
        future: _future,
        builder: (context, snap) {
          if (snap.connectionState != ConnectionState.done) return const Center(child: CircularProgressIndicator());
          if (snap.hasError) {
            return Center(
              child: Column(mainAxisSize: MainAxisSize.min, children: [
                Text(snap.error.toString()),
                const SizedBox(height: 12),
                FilledButton(onPressed: () => setState(() => _future = Api.instance.settlement()), child: const Text('Retry')),
              ]),
            );
          }
          final s = snap.data!;
          final maxRevenue = s.operators.fold<double>(1, (m, o) => o.settledRevenue > m ? o.settledRevenue : m);
          Widget stat(String value, String label) => Expanded(
                child: Card(
                  child: Padding(
                    padding: const EdgeInsets.all(12),
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(value, style: text.titleLarge?.copyWith(fontWeight: FontWeight.w700)),
                      Text(label, style: TextStyle(fontSize: 12, color: scheme.onSurfaceVariant)),
                    ]),
                  ),
                ),
              );
          final weights = s.costWeights.entries.map((e) => '${modeStyle(e.key).label} ${e.value}').join(', ');
          return ListView(padding: const EdgeInsets.all(12), children: [
            Text('One integrated ticket per journey. Revenue from issued tickets is settled between operators by a transparent rule.',
                style: TextStyle(color: scheme.onSurfaceVariant)),
            const SizedBox(height: 12),
            Row(children: [
              stat('${s.trips}', 'tickets issued'),
              const SizedBox(width: 8),
              stat('${s.multimodalTrips}', 'used 2+ operators'),
            ]),
            const SizedBox(height: 8),
            Row(children: [
              stat(rupees(s.integratedRevenue), 'collected'),
              const SizedBox(width: 8),
              stat(rupees(s.commuterSavings), 'saved by commuters'),
            ]),
            const SizedBox(height: 16),
            Text('Settlement per operator', style: text.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
            const SizedBox(height: 8),
            if (s.operators.isEmpty)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 24),
                child: Text('No tickets issued yet.', textAlign: TextAlign.center, style: TextStyle(color: scheme.onSurfaceVariant)),
              ),
            ...s.operators.map((o) => _OperatorRow(o: o, maxRevenue: maxRevenue)),
            const SizedBox(height: 16),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(14),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text('How the split works', style: text.titleSmall?.copyWith(fontWeight: FontWeight.w700)),
                  const SizedBox(height: 6),
                  Text('1. Each leg is priced on its operator\'s own fare slabs.\n'
                      '2. Journeys using 2+ operators get a ${s.integrationDiscountPct}% integration discount.\n'
                      '3. ${weights.isEmpty ? 'The integrated fare is split by each operator\'s standalone fare (operating cost weights not configured yet).' : 'The integrated fare is split ${s.fareWeightPct}% by each operator\'s standalone fare and ${100 - s.fareWeightPct}% by passenger-km weighted by operating cost ($weights).'}'),
                ]),
              ),
            ),
          ]);
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
    final color = modeStyle(o.mode).color;
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Expanded(child: Text(o.operatorName, style: const TextStyle(fontWeight: FontWeight.w600))),
            Text(rupees(o.settledRevenue), style: const TextStyle(fontWeight: FontWeight.w700)),
          ]),
          const SizedBox(height: 6),
          ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: LinearProgressIndicator(
              value: o.settledRevenue / maxRevenue,
              minHeight: 8,
              color: color,
              backgroundColor: color.withValues(alpha: 0.15),
            ),
          ),
          const SizedBox(height: 6),
          Text(
            '${o.revenueSharePct.toStringAsFixed(1)}% of revenue · ${o.trips} trips · ${o.passengerKm.toStringAsFixed(0)} pkm · '
            '${o.vsStandalone >= 0 ? '+' : ''}${rupees(o.vsStandalone)} vs separate tickets',
            style: TextStyle(fontSize: 12, color: scheme.onSurfaceVariant),
          ),
        ]),
      ),
    );
  }
}
