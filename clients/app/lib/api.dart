import 'dart:async';
import 'dart:convert';

import 'package:http/http.dart' as http;

import 'config.dart';
import 'models.dart';

class ApiException implements Exception {
  final String message;
  final bool offline;
  ApiException(this.message, {this.offline = false});
  @override
  String toString() => message;
}

class Api {
  Api._();
  static final instance = Api._();

  static const _timeout = Duration(seconds: 20);

  Future<dynamic> _send(Future<http.Response> Function() request) async {
    final http.Response res;
    try {
      res = await request().timeout(_timeout);
    } on TimeoutException {
      throw ApiException('The server took too long to answer. Check your connection and try again.', offline: true);
    } catch (_) {
      throw ApiException('Can\'t reach the One Journey server. Check your connection and try again.', offline: true);
    }
    dynamic body;
    try {
      body = res.body.isEmpty ? null : jsonDecode(utf8.decode(res.bodyBytes));
    } on FormatException {
      body = null;
    }
    if (res.statusCode >= 400) {
      if (body is Map && body['error'] != null) throw ApiException(body['error'].toString());
      if (res.statusCode == 503) throw ApiException('The service is starting up or its data is unavailable. Try again shortly.');
      throw ApiException('Something went wrong (error ${res.statusCode}). Try again.');
    }
    return body;
  }

  Uri _uri(String path, [Map<String, String>? query]) =>
      Uri.parse('${AppConfig.apiBase}$path').replace(queryParameters: query);

  Future<dynamic> _get(String path, [Map<String, String>? query]) => _send(() => http.get(_uri(path, query)));

  Future<dynamic> _post(String path, Map<String, dynamic> body) => _send(() => http.post(
        _uri(path),
        headers: const {'Content-Type': 'application/json'},
        body: jsonEncode(body),
      ));

  Future<List<Stop>> searchStops(String q, {int limit = 25}) async {
    final list = await _get('/stops', {'q': q, 'limit': '$limit'}) as List;
    return list.cast<Map<String, dynamic>>().map(Stop.fromJson).toList();
  }

  Future<List<Stop>> nearestStops(double lat, double lng, {int limit = 5}) async {
    final list = await _get('/stops/nearest', {'lat': '$lat', 'lng': '$lng', 'limit': '$limit'}) as List;
    return list.cast<Map<String, dynamic>>().map(Stop.fromJson).toList();
  }

  Map<String, String> _endpoints(TripRequest trip) => {
        'from': trip.from.query,
        'to': trip.to.query,
        if (trip.from.stopId == null) 'fromName': trip.from.label,
        if (trip.to.stopId == null) 'toName': trip.to.label,
      };

  Future<PlanResult> plan(TripRequest trip) async {
    final query = {..._endpoints(trip), if (trip.depart != null) 'depart': trip.depart!};
    return PlanResult.fromJson(await _get('/plan', query));
  }

  /// Issues an integrated ticket. The server re-plans at [departAt] (the time the
  /// options were planned for) and matches the chosen option by its signature.
  Future<Ticket> bookTicket(TripRequest trip, JourneyOption option, {required String departAt}) async {
    final body = <String, dynamic>{
      ..._endpoints(trip),
      'signature': option.signature,
      'optionId': option.id,
      if (departAt.isNotEmpty) 'depart': departAt,
    };
    return Ticket.fromJson(await _post('/tickets', body));
  }

  Future<Ticket> ticket(String id) async => Ticket.fromJson(await _get('/tickets/${Uri.encodeComponent(id)}'));

  /// Active and upcoming closures.
  Future<List<Disruption>> closures() async {
    final list = await _get('/closures') as List? ?? const [];
    return list.cast<Map<String, dynamic>>().map(Disruption.fromJson).toList();
  }

  Future<WeatherNow> weather() async => WeatherNow.fromJson(await _get('/weather') as Map<String, dynamic>?);

  Future<List<Hub>> hubs({int minModes = 2}) async {
    final list = await _get('/hubs', {'minModes': '$minModes'}) as List;
    return list.cast<Map<String, dynamic>>().map(Hub.fromJson).toList();
  }

  Future<Settlement> settlement() async => Settlement.fromJson(await _get('/settlement'));
}
