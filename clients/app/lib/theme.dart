import 'package:flutter/material.dart';

/// The three colours of the whole UI. Every surface, text, border and state is
/// derived from these by tint, shade or alpha.
class AppColors {
  static const primary = Color(0xFF0B3D91);
  static const neutral = Color(0xFF475569);
  static const accent = Color(0xFFF2A900);

  /// Mixes [c] toward white by [t] (0..1).
  static Color tint(Color c, double t) => Color.lerp(c, const Color(0xFFFFFFFF), t)!;

  /// Mixes [c] toward black by [t] (0..1).
  static Color shade(Color c, double t) => Color.lerp(c, const Color(0xFF000000), t)!;

  /// Near-white and near-black neutrals, for pins, borders and shadows on the map.
  static final paper = tint(neutral, 0.97);
  static final ink = shade(neutral, 0.7);
}

/// Spacing scale used across the app.
class Space {
  static const double xs = 4;
  static const double s = 8;
  static const double m = 12;
  static const double l = 16;
  static const double xl = 24;
  static const double xxl = 32;
}

/// Corner radii.
class Radii {
  static const double s = 8;
  static const double m = 12;
  static const double l = 16;
  static const double xl = 24;
}

/// Modes are told apart by icon and label only.
class ModeStyle {
  final String label;
  final IconData icon;
  const ModeStyle(this.label, this.icon);
}

const modeStyles = <String, ModeStyle>{
  'metro': ModeStyle('Metro', Icons.subway_outlined),
  'brts': ModeStyle('BRTS', Icons.directions_bus_filled_outlined),
  'amts': ModeStyle('AMTS', Icons.directions_bus_outlined),
  'gsrtc': ModeStyle('GSRTC', Icons.airport_shuttle_outlined),
  'gmcbus': ModeStyle('GMC Bus', Icons.departure_board_outlined),
};

const walkStyle = ModeStyle('Walk', Icons.directions_walk);

ModeStyle modeStyle(String? mode) => modeStyles[mode] ?? walkStyle;

/// "Metro Blue", "BRTS 4", or just "Metro".
String lineLabel(String? mode, String? line) {
  final m = modeStyle(mode).label;
  return line == null || line.isEmpty ? m : '$m $line';
}

/// Start and destination markers.
const startColor = AppColors.primary;
const endColor = AppColors.accent;

/// Positive state (active ticket, savings): primary, always paired with an icon.
Color successColor(BuildContext context) => Theme.of(context).colorScheme.primary;

/// Caution state (alerts, heat, not running): accent, darkened on light surfaces for legibility.
Color warningColor(BuildContext context) =>
    Theme.of(context).brightness == Brightness.dark ? AppColors.accent : AppColors.shade(AppColors.accent, 0.45);

const tagLabels = {
  'recommended': 'Recommended',
  'fastest': 'Fastest',
  'fewestTransfers': 'Fewest changes',
  'leastWalking': 'Least walking',
  'cheapest': 'Cheapest',
};

ColorScheme _scheme(Brightness b) {
  const p = AppColors.primary;
  const n = AppColors.neutral;
  const a = AppColors.accent;
  final t = AppColors.tint;
  final s = AppColors.shade;
  if (b == Brightness.light) {
    return ColorScheme(
      brightness: b,
      primary: p,
      onPrimary: t(n, 1),
      primaryContainer: t(p, 0.88),
      onPrimaryContainer: s(p, 0.35),
      secondary: n,
      onSecondary: t(n, 1),
      secondaryContainer: t(n, 0.86),
      onSecondaryContainer: s(n, 0.55),
      tertiary: s(a, 0.45),
      onTertiary: t(n, 1),
      tertiaryContainer: t(a, 0.8),
      onTertiaryContainer: s(a, 0.7),
      error: s(a, 0.5),
      onError: t(n, 1),
      errorContainer: t(a, 0.78),
      onErrorContainer: s(a, 0.75),
      surface: t(n, 0.97),
      onSurface: s(n, 0.65),
      surfaceContainerLowest: t(n, 1),
      surfaceContainerLow: t(n, 0.95),
      surfaceContainer: t(n, 0.92),
      surfaceContainerHigh: t(n, 0.89),
      surfaceContainerHighest: t(n, 0.86),
      onSurfaceVariant: n,
      outline: t(n, 0.45),
      outlineVariant: t(n, 0.78),
      shadow: s(n, 0.8),
      scrim: s(n, 0.8),
      inverseSurface: s(n, 0.6),
      onInverseSurface: t(n, 0.95),
      inversePrimary: t(p, 0.6),
      surfaceTint: p,
    );
  }
  return ColorScheme(
    brightness: b,
    primary: t(p, 0.62),
    onPrimary: s(p, 0.55),
    primaryContainer: s(p, 0.25),
    onPrimaryContainer: t(p, 0.85),
    secondary: t(n, 0.55),
    onSecondary: s(n, 0.7),
    secondaryContainer: s(n, 0.35),
    onSecondaryContainer: t(n, 0.88),
    tertiary: a,
    onTertiary: s(a, 0.8),
    tertiaryContainer: s(a, 0.6),
    onTertiaryContainer: t(a, 0.8),
    error: a,
    onError: s(a, 0.8),
    errorContainer: s(a, 0.65),
    onErrorContainer: t(a, 0.75),
    surface: s(n, 0.8),
    onSurface: t(n, 0.92),
    surfaceContainerLowest: s(n, 0.86),
    surfaceContainerLow: s(n, 0.76),
    surfaceContainer: s(n, 0.72),
    surfaceContainerHigh: s(n, 0.67),
    surfaceContainerHighest: s(n, 0.62),
    onSurfaceVariant: t(n, 0.6),
    outline: t(n, 0.2),
    outlineVariant: s(n, 0.45),
    shadow: s(n, 0.95),
    scrim: s(n, 0.95),
    inverseSurface: t(n, 0.9),
    onInverseSurface: s(n, 0.7),
    inversePrimary: p,
    surfaceTint: t(p, 0.62),
  );
}

ThemeData buildTheme(Brightness brightness) {
  final scheme = _scheme(brightness);
  final base = ThemeData(colorScheme: scheme, useMaterial3: true, brightness: brightness);
  final text = base.textTheme;
  final rounded = RoundedRectangleBorder(borderRadius: BorderRadius.circular(Radii.m));
  return base.copyWith(
    scaffoldBackgroundColor: scheme.surface,
    materialTapTargetSize: MaterialTapTargetSize.padded,
    textTheme: text.copyWith(
      headlineSmall: text.headlineSmall?.copyWith(fontWeight: FontWeight.w700),
      titleLarge: text.titleLarge?.copyWith(fontWeight: FontWeight.w700),
      titleMedium: text.titleMedium?.copyWith(fontWeight: FontWeight.w600),
      labelLarge: text.labelLarge?.copyWith(fontWeight: FontWeight.w600),
    ),
    appBarTheme: AppBarTheme(
      backgroundColor: scheme.surface,
      foregroundColor: scheme.onSurface,
      surfaceTintColor: scheme.surfaceTint,
      scrolledUnderElevation: 1,
      centerTitle: false,
      titleTextStyle: text.titleLarge?.copyWith(fontWeight: FontWeight.w700, color: scheme.onSurface),
    ),
    cardTheme: CardThemeData(
      margin: EdgeInsets.zero,
      elevation: 0,
      color: scheme.surfaceContainerLowest,
      clipBehavior: Clip.antiAlias,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(Radii.l),
        side: BorderSide(color: scheme.outlineVariant),
      ),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        minimumSize: const Size(64, 48),
        shape: rounded,
        textStyle: text.labelLarge?.copyWith(fontWeight: FontWeight.w700),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(minimumSize: const Size(64, 48), shape: rounded),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(minimumSize: const Size(48, 48), shape: rounded),
    ),
    chipTheme: ChipThemeData(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(Radii.s)),
      labelStyle: text.labelLarge,
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: scheme.surfaceContainerHigh,
      contentPadding: const EdgeInsets.symmetric(horizontal: Space.l, vertical: Space.m),
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(Radii.m), borderSide: BorderSide.none),
    ),
    bottomSheetTheme: BottomSheetThemeData(
      showDragHandle: true,
      backgroundColor: scheme.surfaceContainerLow,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(Radii.xl))),
    ),
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: scheme.surfaceContainerLow,
      indicatorColor: scheme.primaryContainer,
    ),
    badgeTheme: BadgeThemeData(backgroundColor: AppColors.accent, textColor: AppColors.shade(AppColors.accent, 0.8)),
    progressIndicatorTheme: ProgressIndicatorThemeData(color: scheme.primary),
    dividerTheme: DividerThemeData(color: scheme.outlineVariant),
    snackBarTheme: const SnackBarThemeData(behavior: SnackBarBehavior.floating),
    listTileTheme: ListTileThemeData(minVerticalPadding: Space.m, iconColor: scheme.onSurfaceVariant),
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

String plural(int n, String one, [String? many]) => '$n ${n == 1 ? one : (many ?? '${one}s')}';

String changesLabel(int transfers) => transfers == 0 ? 'Direct' : plural(transfers, 'change');

/// Minutes after midnight for an "HH:MM" clock string, or null.
int? clockToMin(String? hhmm) {
  final m = RegExp(r'^(\d{1,2}):(\d{2})$').firstMatch(hhmm ?? '');
  if (m == null) return null;
  return int.parse(m.group(1)!) * 60 + int.parse(m.group(2)!);
}

String twoDigits(int v) => v.toString().padLeft(2, '0');

String clockOf(DateTime t) => '${twoDigits(t.hour)}:${twoDigits(t.minute)}';
