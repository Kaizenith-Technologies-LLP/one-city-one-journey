import 'dart:convert';

import 'package:http/http.dart' as http;

import 'config.dart';
import 'models.dart';

class ApiException implements Exception {
  final String message;
  ApiException(this.message);
  @override
  String toString() => message;
}

class Api {
  Api._();
  static final instance = Api._();

  Future<dynamic> _get(String path, [Map<String, String>? query]) async {
    final uri = Uri.parse('${AppConfig.apiBase}$path').replace(queryParameters: query);
    final http.Response res;
    try {
      res = await http.get(uri).timeout(const Duration(seconds: 20));
    } catch (_) {
      throw ApiException('Cannot reach the server at ${AppConfig.apiBase}');
    }
    final body = res.body.isEmpty ? null : jsonDecode(utf8.decode(res.bodyBytes));
    if (res.statusCode >= 400) {
      throw ApiException(body is Map && body['error'] != null ? body['error'] : 'Request failed (${res.statusCode})');
    }
    return body;
  }

  Future<List<Stop>> searchStops(String q, {int limit = 25}) async {
    final list = await _get('/stops', {'q': q, 'limit': '$limit'}) as List;
    return list.map((e) => Stop.fromJson(e)).toList();
  }

  Future<List<Stop>> nearestStops(double lat, double lng, {int limit = 5}) async {
    final list = await _get('/stops/nearest', {'lat': '$lat', 'lng': '$lng', 'limit': '$limit'}) as List;
    return list.map((e) => Stop.fromJson(e)).toList();
  }

  Future<PlanResult> plan(Place from, Place to) async {
    final query = {'from': from.query, 'to': to.query};
    if (from.stopId == null) query['fromName'] = from.label;
    if (to.stopId == null) query['toName'] = to.label;
    return PlanResult.fromJson(await _get('/plan', query));
  }

  Future<List<Hub>> hubs({int minModes = 2}) async {
    final list = await _get('/hubs', {'minModes': '$minModes'}) as List;
    return list.map((e) => Hub.fromJson(e)).toList();
  }

  Future<Settlement> settlement() async => Settlement.fromJson(await _get('/settlement'));
}
