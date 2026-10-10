import 'package:flutter/material.dart';

import '../api.dart';
import '../theme.dart';

/// Pulsing placeholder block shown while content loads.
class SkeletonBox extends StatefulWidget {
  final double? width;
  final double height;
  final double radius;
  const SkeletonBox({super.key, this.width, this.height = 14, this.radius = Radii.s});

  @override
  State<SkeletonBox> createState() => _SkeletonBoxState();
}

class _SkeletonBoxState extends State<SkeletonBox> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: const Duration(milliseconds: 900))
    ..repeat(reverse: true);

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final base = Theme.of(context).colorScheme.surfaceContainerHighest;
    return FadeTransition(
      opacity: Tween(begin: 0.45, end: 1.0).animate(_c),
      child: Container(
        width: widget.width,
        height: widget.height,
        decoration: BoxDecoration(color: base, borderRadius: BorderRadius.circular(widget.radius)),
      ),
    );
  }
}

/// A list of card-shaped skeletons with a screen-reader label.
class SkeletonCards extends StatelessWidget {
  final int count;
  final String label;
  final EdgeInsets padding;
  const SkeletonCards({super.key, this.count = 4, required this.label, this.padding = const EdgeInsets.all(Space.l)});

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: label,
      liveRegion: true,
      child: ExcludeSemantics(
        child: ListView.separated(
          physics: const NeverScrollableScrollPhysics(),
          padding: padding,
          itemCount: count,
          separatorBuilder: (_, _) => const SizedBox(height: Space.m),
          itemBuilder: (_, i) => Card(
            child: Padding(
              padding: const EdgeInsets.all(Space.l),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Row(children: [
                  SkeletonBox(width: i == 0 ? 140 : 110, height: 22),
                  const Spacer(),
                  const SkeletonBox(width: 56, height: 22),
                ]),
                const SizedBox(height: Space.m),
                const SkeletonBox(width: 200),
                const SizedBox(height: Space.m),
                const Row(children: [
                  SkeletonBox(width: 60, height: 20),
                  SizedBox(width: Space.s),
                  SkeletonBox(width: 60, height: 20),
                ]),
              ]),
            ),
          ),
        ),
      ),
    );
  }
}

/// Centered icon + title + message + optional action; used for empty and error states.
class MessageView extends StatelessWidget {
  final IconData icon;
  final String title;
  final String? message;
  final Widget? action;
  final Widget? secondary;
  final Color? iconColor;

  const MessageView({
    super.key,
    required this.icon,
    required this.title,
    this.message,
    this.action,
    this.secondary,
    this.iconColor,
  });

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final text = Theme.of(context).textTheme;
    return LayoutBuilder(
      builder: (context, constraints) => SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(Space.xl),
        child: ConstrainedBox(
          constraints: BoxConstraints(minHeight: constraints.maxHeight.isFinite ? constraints.maxHeight - Space.xl * 2 : 0),
          child: Center(
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              Container(
                padding: const EdgeInsets.all(Space.l),
                decoration: BoxDecoration(color: scheme.surfaceContainerHighest, shape: BoxShape.circle),
                child: Icon(icon, size: 36, color: iconColor ?? scheme.onSurfaceVariant),
              ),
              const SizedBox(height: Space.l),
              Semantics(header: true, child: Text(title, textAlign: TextAlign.center, style: text.titleMedium)),
              if (message != null) ...[
                const SizedBox(height: Space.s),
                Text(message!, textAlign: TextAlign.center, style: text.bodyMedium?.copyWith(color: scheme.onSurfaceVariant)),
              ],
              if (action != null) ...[const SizedBox(height: Space.xl), action!],
              if (secondary != null) ...[const SizedBox(height: Space.s), secondary!],
            ]),
          ),
        ),
      ),
    );
  }
}

/// Friendly error with a retry button.
class ErrorView extends StatelessWidget {
  final Object error;
  final VoidCallback onRetry;
  const ErrorView({super.key, required this.error, required this.onRetry});

  @override
  Widget build(BuildContext context) {
    final offline = error is ApiException && (error as ApiException).offline;
    return MessageView(
      icon: offline ? Icons.wifi_off_rounded : Icons.error_outline_rounded,
      iconColor: Theme.of(context).colorScheme.error,
      title: offline ? 'You seem to be offline' : 'Something went wrong',
      message: error is ApiException ? error.toString() : 'Please try again.',
      action: FilledButton.icon(onPressed: onRetry, icon: const Icon(Icons.refresh), label: const Text('Try again')),
    );
  }
}

/// Section heading with consistent spacing.
class SectionHeader extends StatelessWidget {
  final String title;
  final Widget? trailing;
  const SectionHeader(this.title, {super.key, this.trailing});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: Space.s, bottom: Space.s),
      child: Row(children: [
        Expanded(child: Semantics(header: true, child: Text(title, style: Theme.of(context).textTheme.titleMedium))),
        ?trailing,
      ]),
    );
  }
}

/// Small rounded label, e.g. a route tag or a ticket status.
class Pill extends StatelessWidget {
  final String text;
  final Color background;
  final Color foreground;
  final IconData? icon;
  const Pill({super.key, required this.text, required this.background, required this.foreground, this.icon});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: Space.s, vertical: 3),
      decoration: BoxDecoration(color: background, borderRadius: BorderRadius.circular(Radii.xl)),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        if (icon != null) ...[Icon(icon, size: 14, color: foreground), const SizedBox(width: 4)],
        Flexible(
          child: Text(text,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: foreground)),
        ),
      ]),
    );
  }
}
