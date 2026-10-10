import 'package:flutter/material.dart';

class ModeStyle {
  final String label;
  final Color color;
  final IconData icon;
  const ModeStyle(this.label, this.color, this.icon);
}

const modeStyles = <String, ModeStyle>{
  'metro': ModeStyle('Metro', Color(0xFF1E5BC6), Icons.subway),
  'brts': ModeStyle('BRTS', Color(0xFFD7263D), Icons.directions_bus_filled),
  'amts': ModeStyle('AMTS', Color(0xFFF4A300), Icons.directions_bus),
  'gsrtc': ModeStyle('GSRTC', Color(0xFF2A9D8F), Icons.airport_shuttle),
  'gmcbus': ModeStyle('GMC Bus', Color(0xFF8E44AD), Icons.directions_bus_outlined),
};

ModeStyle modeStyle(String? mode) =>
    modeStyles[mode] ?? const ModeStyle('Walk', Color(0xFF6B7280), Icons.directions_walk);

Color parseHex(String? hex, Color fallback) {
  if (hex == null || !hex.startsWith('#') || hex.length != 7) return fallback;
  return Color(int.parse('FF${hex.substring(1)}', radix: 16));
}

const tagLabels = {
  'fastest': 'Fastest',
  'cheapest': 'Cheapest',
  'leastWalking': 'Least walking',
  'fewestTransfers': 'Fewest changes',
};

ThemeData buildTheme(Brightness brightness) {
  final scheme = ColorScheme.fromSeed(seedColor: const Color(0xFF1E5BC6), brightness: brightness);
  return ThemeData(
    colorScheme: scheme,
    useMaterial3: true,
    cardTheme: const CardThemeData(margin: EdgeInsets.zero, clipBehavior: Clip.antiAlias),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: scheme.surfaceContainerHighest.withValues(alpha: 0.5),
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide.none),
    ),
  );
}

String formatMin(int min) {
  if (min < 60) return '$min min';
  final h = min ~/ 60;
  final m = min % 60;
  return m == 0 ? '$h h' : '$h h $m min';
}

String formatDistance(int m) => m >= 1000 ? '${(m / 1000).toStringAsFixed(1)} km' : '$m m';

String rupees(num v) => v == v.roundToDouble() ? '₹${v.round()}' : '₹${v.toStringAsFixed(2)}';
