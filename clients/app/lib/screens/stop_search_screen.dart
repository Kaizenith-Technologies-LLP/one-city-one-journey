import 'dart:async';

import 'package:flutter/material.dart';

import '../api.dart';
import '../models.dart';
import '../store.dart';
import '../theme.dart';
import '../widgets/state_views.dart';
import 'map_pick_screen.dart';

/// Search a stop or pick a point on the map. Pops with the chosen [Place].
class StopSearchScreen extends StatefulWidget {
  final String title;
  final String hint;
  const StopSearchScreen({super.key, required this.title, required this.hint});

  @override
  State<StopSearchScreen> createState() => _StopSearchScreenState();
}

class _StopSearchScreenState extends State<StopSearchScreen> {
  final _controller = TextEditingController();
  Timer? _debounce;
  List<Stop> _results = [];
  Object? _error;
  bool _loading = false;
  int _requestId = 0;

  @override
  void initState() {
    super.initState();
    _search('');
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _controller.dispose();
    super.dispose();
  }

  void _onChanged(String q) {
    setState(() {});
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 250), () => _search(q));
  }

  Future<void> _search(String q) async {
    final id = ++_requestId;
    setState(() => _loading = true);
    try {
      final r = await Api.instance.searchStops(q.trim(), limit: 40);
      if (id != _requestId || !mounted) return;
      setState(() {
        _results = r;
        _error = null;
      });
    } catch (e) {
      if (id != _requestId || !mounted) return;
      setState(() => _error = e);
    } finally {
      if (id == _requestId && mounted) setState(() => _loading = false);
    }
  }

  void _choose(Place p) {
    AppStore.instance.recentPlaces.add(p);
    Navigator.pop(context, p);
  }

  Future<void> _pickOnMap() async {
    final p = await Navigator.push<Place>(context, MaterialPageRoute(builder: (_) => MapPickScreen(title: widget.title)));
    if (p != null && mounted) _choose(p);
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final query = _controller.text.trim();
    final recents = query.isEmpty ? AppStore.instance.recentPlaces.items : const <Place>[];
    return Scaffold(
      appBar: AppBar(title: Text(widget.title)),
      body: Column(children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(Space.l, Space.xs, Space.l, Space.s),
          child: TextField(
            controller: _controller,
            autofocus: true,
            onChanged: _onChanged,
            textInputAction: TextInputAction.search,
            decoration: InputDecoration(
              prefixIcon: const Icon(Icons.search),
              hintText: widget.hint,
              suffixIcon: query.isEmpty
                  ? null
                  : IconButton(
                      tooltip: 'Clear search',
                      icon: const Icon(Icons.close),
                      onPressed: () {
                        _controller.clear();
                        _onChanged('');
                      },
                    ),
            ),
          ),
        ),
        SizedBox(height: 3, child: _loading ? const LinearProgressIndicator(minHeight: 3) : null),
        Expanded(
          child: ListView(children: [
            ListTile(
              leading: CircleAvatar(
                backgroundColor: scheme.secondaryContainer,
                child: Icon(Icons.map_outlined, color: scheme.onSecondaryContainer),
              ),
              title: const Text('Choose on map'),
              subtitle: const Text('Drop a pin anywhere'),
              onTap: _pickOnMap,
            ),
            if (recents.isNotEmpty) ...[
              const Padding(
                padding: EdgeInsets.fromLTRB(Space.l, Space.s, Space.l, 0),
                child: SectionHeader('Recent'),
              ),
              ...recents.map((p) => ListTile(
                    leading: const CircleAvatar(child: Icon(Icons.history)),
                    title: Text(p.label),
                    subtitle: Text(p.stopId == null ? 'Point on map' : modeStyle(p.mode).label),
                    onTap: () => _choose(p),
                  )),
            ],
            const Divider(height: Space.l),
            if (_error != null)
              Padding(
                padding: const EdgeInsets.all(Space.l),
                child: Column(children: [
                  Text(_error.toString(), textAlign: TextAlign.center, style: TextStyle(color: scheme.error)),
                  const SizedBox(height: Space.s),
                  OutlinedButton.icon(
                    onPressed: () => _search(_controller.text),
                    icon: const Icon(Icons.refresh),
                    label: const Text('Try again'),
                  ),
                ]),
              )
            else if (!_loading && _results.isEmpty)
              Padding(
                padding: const EdgeInsets.all(Space.xl),
                child: Text(
                  query.isEmpty ? 'No stops are available right now.' : 'No stops match "$query". Try another spelling or choose on map.',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: scheme.onSurfaceVariant),
                ),
              )
            else ...[
              if (query.isEmpty)
                const Padding(
                  padding: EdgeInsets.symmetric(horizontal: Space.l),
                  child: SectionHeader('Stations and stops'),
                ),
              ..._results.map((s) {
                final st = modeStyle(s.mode);
                return ListTile(
                  leading: CircleAvatar(backgroundColor: scheme.secondaryContainer, child: Icon(st.icon, color: scheme.onSecondaryContainer, size: 20)),
                  title: Text(s.name),
                  subtitle: Text(
                    [st.label, plural(s.lines.length, 'line'), if (s.hubId != null) 'Interchange'].join(' · '),
                  ),
                  onTap: () => _choose(Place.fromStop(s)),
                );
              }),
            ],
          ]),
        ),
      ]),
    );
  }
}
