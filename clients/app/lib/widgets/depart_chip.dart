import 'package:flutter/material.dart';

import '../theme.dart';

/// Result of [pickDeparture]: [value] is "HH:MM" (today), an IST date-time
/// for tomorrow, or null for "leave now".
class DepartChoice {
  final String? value;
  const DepartChoice(this.value);
}

/// True when [depart] is a tomorrow date-time rather than a time today.
bool isTomorrow(String? depart) => depart != null && depart.contains('T');

/// The "HH:MM" part of a departure value.
String? departClock(String? depart) => isTomorrow(depart) ? depart!.substring(11, 16) : depart;

/// Tomorrow's date in India, as an ISO date-time at [time] (+05:30).
String _tomorrowIst(TimeOfDay time) {
  final d = DateTime.now().toUtc().add(const Duration(hours: 5, minutes: 30, days: 1));
  return '${d.year}-${twoDigits(d.month)}-${twoDigits(d.day)}T${twoDigits(time.hour)}:${twoDigits(time.minute)}:00+05:30';
}

/// Asks "leave now, later today or tomorrow?". Returns null when the user cancels.
Future<DepartChoice?> pickDeparture(BuildContext context, String? current) async {
  final when = await showModalBottomSheet<String>(
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
          onTap: () => Navigator.pop(ctx, 'now'),
        ),
        ListTile(
          leading: const Icon(Icons.schedule_rounded),
          title: const Text('Later today'),
          subtitle: current != null && !isTomorrow(current) ? Text('Now set to $current') : null,
          selected: current != null && !isTomorrow(current),
          onTap: () => Navigator.pop(ctx, 'today'),
        ),
        ListTile(
          leading: const Icon(Icons.event_rounded),
          title: const Text('Tomorrow'),
          subtitle: isTomorrow(current) ? Text('Now set to ${departClock(current)}') : null,
          selected: isTomorrow(current),
          onTap: () => Navigator.pop(ctx, 'tomorrow'),
        ),
        const SizedBox(height: Space.s),
      ]),
    ),
  );
  if (when == null || !context.mounted) return null;
  if (when == 'now') return const DepartChoice(null);
  final set = clockToMin(departClock(current));
  final time = await showTimePicker(
    context: context,
    helpText: when == 'tomorrow' ? 'Leave tomorrow at' : 'Leave today at',
    initialTime: set == null ? (when == 'tomorrow' ? const TimeOfDay(hour: 9, minute: 0) : TimeOfDay.now()) : TimeOfDay(hour: set ~/ 60 % 24, minute: set % 60),
  );
  if (time == null) return null;
  return DepartChoice(when == 'tomorrow' ? _tomorrowIst(time) : '${twoDigits(time.hour)}:${twoDigits(time.minute)}');
}

/// "Leave now" / "Leave at 18:30" / "Tomorrow at 09:00" chip. [onChanged] receives the new value, or null for now.
class DepartChip extends StatelessWidget {
  final String? depart;
  final ValueChanged<String?> onChanged;
  const DepartChip({super.key, required this.depart, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    final label = depart == null
        ? 'Leave now'
        : isTomorrow(depart)
            ? 'Tomorrow at ${departClock(depart)}'
            : 'Leave at $depart';
    return ActionChip(
      avatar: Icon(depart == null ? Icons.bolt_rounded : (isTomorrow(depart) ? Icons.event_rounded : Icons.schedule_rounded), size: 18),
      label: Text(label),
      tooltip: 'Change departure time',
      onPressed: () async {
        final choice = await pickDeparture(context, depart);
        if (choice != null) onChanged(choice.value);
      },
    );
  }
}
