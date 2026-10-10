import 'package:flutter/material.dart';

import '../api.dart';
import '../models.dart';
import '../theme.dart';

/// Simulated day of integrated tickets and what each operator receives.
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
          return ListView(padding: const EdgeInsets.all(12), children: [
            Text('One integrated ticket per journey. Revenue is settled between operators by a transparent rule.',
                style: TextStyle(color: scheme.onSurfaceVariant)),
            const SizedBox(height: 12),
            Row(children: [
              stat('${s.trips}', 'simulated trips'),
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
            ...s.operators.map((o) => _OperatorRow(o: o, maxRevenue: maxRevenue)),
            const SizedBox(height: 16),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(14),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text('How the split works', style: text.titleSmall?.copyWith(fontWeight: FontWeight.w700)),
                  const SizedBox(height: 6),
                  const Text('1. Each leg is priced on its operator\'s own fare slabs.\n'
                      '2. Journeys using 2+ operators get a 10% integration discount.\n'
                      '3. The integrated fare is split 50% by each operator\'s standalone fare and '
                      '50% by passenger-km weighted by operating cost (Metro 1.4, BRTS 1.0, GSRTC 0.9, AMTS 0.8).'),
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
