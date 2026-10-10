import 'package:flutter/material.dart';

import '../models.dart';
import '../theme.dart';

/// "41°C feels-like: routes with less walking preferred", with the data source credited.
class HeatNote extends StatelessWidget {
  final Weather weather;
  const HeatNote({super.key, required this.weather});

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    final warn = warningColor(context);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: Space.m, vertical: Space.s),
      decoration: BoxDecoration(color: warn.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(Radii.m)),
      child: Row(children: [
        Icon(Icons.thermostat_rounded, color: warn, size: 20),
        const SizedBox(width: Space.s),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(
              '${weather.feelsLikeC.round()}°C feels-like: routes with less walking preferred',
              style: text.bodyMedium?.copyWith(fontWeight: FontWeight.w600),
            ),
            if (weather.source.isNotEmpty)
              Text('Weather: ${weather.source}', style: text.bodySmall?.copyWith(color: Theme.of(context).colorScheme.onSurfaceVariant)),
          ]),
        ),
      ]),
    );
  }
}
