import 'package:flutter/material.dart';

import '../api.dart';
import '../models.dart';
import '../theme.dart';
import '../widgets/disruption_card.dart';
import '../widgets/state_views.dart';

/// Active and upcoming closures, each shareable as a WhatsApp-ready message.
class AlertsScreen extends StatefulWidget {
  final List<Disruption> initial;
  const AlertsScreen({super.key, required this.initial});

  @override
  State<AlertsScreen> createState() => _AlertsScreenState();
}

class _AlertsScreenState extends State<AlertsScreen> {
  late Future<List<Disruption>> _future = Future.value(widget.initial);

  Future<void> _reload() async {
    final f = Api.instance.closures();
    setState(() => _future = f);
    await f.then((_) {}, onError: (_) {});
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Service alerts')),
      body: FutureBuilder<List<Disruption>>(
        future: _future,
        builder: (context, snap) {
          if (snap.connectionState != ConnectionState.done) return const SkeletonCards(count: 3, label: 'Loading service alerts');
          if (snap.hasError) return ErrorView(error: snap.error!, onRetry: _reload);
          final list = [...snap.data!]..sort((a, b) => a.isActive == b.isActive ? 0 : (a.isActive ? -1 : 1));
          if (list.isEmpty) {
            return RefreshIndicator(
              onRefresh: _reload,
              child: MessageView(
                icon: Icons.check_circle_outline,
                iconColor: successColor(context),
                title: 'No service alerts',
                message: 'There are no closures in effect or planned right now.',
              ),
            );
          }
          return RefreshIndicator(
            onRefresh: _reload,
            child: ListView.separated(
              padding: const EdgeInsets.all(Space.l),
              itemCount: list.length,
              separatorBuilder: (_, _) => const SizedBox(height: Space.m),
              itemBuilder: (_, i) => DisruptionCard(disruption: list[i]),
            ),
          );
        },
      ),
    );
  }
}
