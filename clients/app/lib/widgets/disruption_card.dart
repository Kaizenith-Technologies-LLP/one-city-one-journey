import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../models.dart';
import '../theme.dart';

const _languages = {'en': 'English', 'gu': 'ગુજરાતી', 'hi': 'हिन्दी'};

String _dateTime(DateTime? t) {
  if (t == null) return '';
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return '${t.day} ${months[t.month - 1]} ${clockOf(t)}';
}

/// One service alert: title, advisory in English / Gujarati / Hindi, and a share action.
class DisruptionCard extends StatefulWidget {
  final Disruption disruption;
  final VoidCallback? onDismiss;
  final bool showShare;

  const DisruptionCard({super.key, required this.disruption, this.onDismiss, this.showShare = true});

  @override
  State<DisruptionCard> createState() => _DisruptionCardState();
}

class _DisruptionCardState extends State<DisruptionCard> {
  String _lang = 'en';

  void _share() {
    final d = widget.disruption;
    Clipboard.setData(ClipboardData(text: d.whatsapp.isEmpty ? '${d.title}\n\n${d.en}' : d.whatsapp));
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Alert copied. Paste it into WhatsApp or any chat.')),
    );
  }

  @override
  Widget build(BuildContext context) {
    final d = widget.disruption;
    final text = Theme.of(context).textTheme;
    final warn = warningColor(context);
    final scheme = Theme.of(context).colorScheme;
    final window = [_dateTime(d.startsAt), _dateTime(d.endsAt)].where((s) => s.isNotEmpty).join(' – ');
    return Card(
      color: warn.withValues(alpha: 0.10),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(Radii.l),
        side: BorderSide(color: warn.withValues(alpha: 0.5)),
      ),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(Space.l, Space.m, Space.xs, Space.m),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Padding(
              padding: const EdgeInsets.only(top: 2),
              child: Icon(Icons.warning_amber_rounded, color: warn),
            ),
            const SizedBox(width: Space.s),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Semantics(header: true, child: Text(d.title, style: text.titleSmall?.copyWith(fontWeight: FontWeight.w700))),
                Text(
                  [d.isActive ? 'In effect now' : 'Upcoming', if (window.isNotEmpty) window].join(' · '),
                  style: text.bodySmall?.copyWith(color: warn, fontWeight: FontWeight.w600),
                ),
              ]),
            ),
            if (widget.onDismiss != null)
              IconButton(tooltip: 'Dismiss alert', icon: const Icon(Icons.close), onPressed: widget.onDismiss),
          ]),
          Padding(
            padding: const EdgeInsets.only(right: Space.m, top: Space.s),
            child: Text(d.text(_lang), style: text.bodyMedium),
          ),
          const SizedBox(height: Space.s),
          Wrap(spacing: Space.s, runSpacing: Space.xs, crossAxisAlignment: WrapCrossAlignment.center, children: [
            ..._languages.entries.map((e) => ChoiceChip(
                  label: Text(e.value),
                  tooltip: 'Show alert in ${e.key == 'en' ? 'English' : e.key == 'gu' ? 'Gujarati' : 'Hindi'}',
                  selected: _lang == e.key,
                  onSelected: (_) => setState(() => _lang = e.key),
                  showCheckmark: false,
                  selectedColor: scheme.secondaryContainer,
                )),
            if (widget.showShare)
              TextButton.icon(onPressed: _share, icon: const Icon(Icons.share_outlined), label: const Text('Share')),
          ]),
        ]),
      ),
    );
  }
}
