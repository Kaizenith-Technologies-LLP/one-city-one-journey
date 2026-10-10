import 'package:flutter/material.dart';

import '../theme.dart';

/// Result of [pickDeparture]: [value] is "HH:MM", or null for "leave now".
class DepartChoice {
  final String? value;
  const DepartChoice(this.value);
}

/// Asks "leave now or at a time?". Returns null when the user cancels.
Future<DepartChoice?> pickDeparture(BuildContext context, String? current) async {
  final pickTime = await showModalBottomSheet<bool>(
    context: context,
    builder: (ctx) => SafeArea(
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(Space.xl, 0, Space.xl, Space.s),
          child: Semantics(
            header: true,
            child: Text('When do you want to leave?', style: Theme.of(ctx).textTheme.titleMedium),
          ),
        ),
        ListTile(
          leading: const Icon(Icons.bolt_rounded),
          title: const Text('Leave now'),
          selected: current == null,
          onTap: () => Navigator.pop(ctx, false),
        ),
        ListTile(
          leading: const Icon(Icons.schedule_rounded),
          title: const Text('Choose a departure time'),
          subtitle: Text(current == null ? 'Later today' : 'Now set to $current'),
          selected: current != null,
          onTap: () => Navigator.pop(ctx, true),
        ),
        const SizedBox(height: Space.s),
      ]),
    ),
  );
  if (pickTime == null || !context.mounted) return null;
  if (!pickTime) return const DepartChoice(null);
  final set = clockToMin(current);
  final time = await showTimePicker(
    context: context,
    helpText: 'Leave at',
    initialTime: set == null ? TimeOfDay.now() : TimeOfDay(hour: set ~/ 60 % 24, minute: set % 60),
  );
  if (time == null) return null;
  return DepartChoice('${twoDigits(time.hour)}:${twoDigits(time.minute)}');
}

/// "Leave now" / "Leave at 18:30" chip. [onChanged] receives "HH:MM", or null for now.
class DepartChip extends StatelessWidget {
  final String? depart;
  final ValueChanged<String?> onChanged;
  const DepartChip({super.key, required this.depart, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    return ActionChip(
      avatar: Icon(depart == null ? Icons.bolt_rounded : Icons.schedule_rounded, size: 18),
      label: Text(depart == null ? 'Leave now' : 'Leave at $depart'),
      tooltip: 'Change departure time',
      onPressed: () async {
        final choice = await pickDeparture(context, depart);
        if (choice != null) onChanged(choice.value);
      },
    );
  }
}
