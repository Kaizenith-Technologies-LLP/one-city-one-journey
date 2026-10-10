import 'dart:async';

import 'package:flutter/material.dart';

import '../api.dart';
import '../models.dart';
import '../theme.dart';

class StopSearchScreen extends StatefulWidget {
  final String title;
  const StopSearchScreen({super.key, required this.title});

  @override
  State<StopSearchScreen> createState() => _StopSearchScreenState();
}

class _StopSearchScreenState extends State<StopSearchScreen> {
  Timer? _debounce;
  List<Stop> _results = [];
  String? _error;
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
    super.dispose();
  }

  void _onChanged(String q) {
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
      setState(() => _error = e.toString());
    } finally {
      if (id == _requestId && mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(widget.title)),
      body: Column(children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 4, 16, 8),
          child: TextField(
            autofocus: true,
            onChanged: _onChanged,
            decoration: const InputDecoration(prefixIcon: Icon(Icons.search), hintText: 'Search a station or bus stop'),
          ),
        ),
        if (_loading) const LinearProgressIndicator(minHeight: 2),
        if (_error != null)
          Padding(padding: const EdgeInsets.all(16), child: Text(_error!, style: const TextStyle(color: Colors.red))),
        Expanded(
          child: ListView.builder(
            itemCount: _results.length,
            itemBuilder: (_, i) {
              final s = _results[i];
              final st = modeStyle(s.mode);
              return ListTile(
                leading: CircleAvatar(backgroundColor: st.color, child: Icon(st.icon, color: Colors.white, size: 20)),
                title: Text(s.name),
                subtitle: Text('${st.label} · ${s.lines.length} line${s.lines.length == 1 ? '' : 's'}'),
                trailing: s.hubId == null
                    ? null
                    : const Tooltip(message: 'Interchange with other modes', child: Icon(Icons.hub, size: 18)),
                onTap: () => Navigator.pop(context, s),
              );
            },
          ),
        ),
      ]),
    );
  }
}
