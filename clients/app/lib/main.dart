import 'package:flutter/material.dart';

import 'screens/hubs_screen.dart';
import 'screens/plan_screen.dart';
import 'screens/settlement_screen.dart';
import 'screens/tickets_screen.dart';
import 'store.dart';
import 'theme.dart';

void main() => runApp(const OneJourneyApp());

class OneJourneyApp extends StatelessWidget {
  const OneJourneyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'One City, One Journey',
      debugShowCheckedModeBanner: false,
      theme: buildTheme(Brightness.light),
      darkTheme: buildTheme(Brightness.dark),
      home: const HomeShell(),
    );
  }
}

class HomeShell extends StatefulWidget {
  const HomeShell({super.key});

  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> {
  int _index = 0;

  @override
  Widget build(BuildContext context) {
    final tickets = AppStore.instance.tickets;
    return Scaffold(
      body: IndexedStack(index: _index, children: [
        const PlanScreen(),
        TicketsScreen(onPlanTrip: () => setState(() => _index = 0)),
        const HubsScreen(),
        const SettlementScreen(),
      ]),
      bottomNavigationBar: ListenableBuilder(
        listenable: tickets,
        builder: (context, _) {
          final now = DateTime.now();
          final active = tickets.items.where((t) => t.statusAt(now) == 'active').length;
          return NavigationBar(
            selectedIndex: _index,
            onDestinationSelected: (i) => setState(() => _index = i),
            destinations: [
              const NavigationDestination(icon: Icon(Icons.alt_route_outlined), selectedIcon: Icon(Icons.alt_route), label: 'Plan'),
              NavigationDestination(
                icon: Badge(isLabelVisible: active > 0, label: Text('$active'), child: const Icon(Icons.confirmation_number_outlined)),
                selectedIcon: Badge(isLabelVisible: active > 0, label: Text('$active'), child: const Icon(Icons.confirmation_number)),
                label: 'Tickets',
                tooltip: active > 0 ? 'My tickets, $active active' : 'My tickets',
              ),
              const NavigationDestination(icon: Icon(Icons.hub_outlined), selectedIcon: Icon(Icons.hub), label: 'Interchanges'),
              const NavigationDestination(
                icon: Icon(Icons.account_balance_outlined),
                selectedIcon: Icon(Icons.account_balance),
                label: 'Fare share',
              ),
            ],
          );
        },
      ),
    );
  }
}
