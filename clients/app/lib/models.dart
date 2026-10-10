import 'package:latlong2/latlong.dart';

double _d(dynamic v) => (v as num?)?.toDouble() ?? 0;
int _i(dynamic v) => (v as num?)?.round() ?? 0;
List<String> _strings(dynamic v) => (v as List? ?? const []).map((e) => e.toString()).toList();

class Stop {
  final String id;
  final String name;
  final String mode;
  final double lat;
  final double lng;
  final List<String> lines;
  final String? hubId;
  final int? distanceM;

  const Stop({
    required this.id,
    required this.name,
    required this.mode,
    required this.lat,
    required this.lng,
    this.lines = const [],
    this.hubId,
    this.distanceM,
  });

  LatLng get latLng => LatLng(lat, lng);

  factory Stop.fromJson(Map<String, dynamic> j) => Stop(
        id: j['id'] ?? j['stopId'] ?? '',
        name: j['name'] ?? '',
        mode: j['mode'] ?? '',
        lat: _d(j['lat']),
        lng: _d(j['lng']),
        lines: _strings(j['lines']),
        hubId: j['hubId'],
        distanceM: j['distanceM'] == null ? null : _i(j['distanceM']),
      );
}

/// A start or destination: either a stop or a raw point picked on the map.
class Place {
  final String label;
  final String? stopId;
  final String? mode;
  final LatLng point;

  const Place({required this.label, required this.point, this.stopId, this.mode});

  factory Place.fromStop(Stop s) => Place(label: s.name, stopId: s.id, mode: s.mode, point: s.latLng);

  /// Query value accepted by /api/plan: a stop id or "lat,lng".
  String get query => stopId ?? '${point.latitude.toStringAsFixed(6)},${point.longitude.toStringAsFixed(6)}';
}

class PathPoint {
  final String name;
  final LatLng point;
  const PathPoint(this.name, this.point);
}

class Leg {
  final String type; // walk | ride
  final String instruction;
  final String fromName;
  final String toName;
  final LatLng from;
  final LatLng to;
  final String? toHubId;
  // walk
  final int distanceM;
  final int durationMin;
  // ride
  final String? mode;
  final String? operator;
  final String? lineName;
  final String? lineShortName;
  final String? color;
  final String? towards;
  final int stopCount;
  final double distanceKm;
  final int waitMin;
  final int rideMin;
  final int headwayMin;
  final List<PathPoint> path;

  const Leg({
    required this.type,
    required this.instruction,
    required this.fromName,
    required this.toName,
    required this.from,
    required this.to,
    this.toHubId,
    this.distanceM = 0,
    this.durationMin = 0,
    this.mode,
    this.operator,
    this.lineName,
    this.lineShortName,
    this.color,
    this.towards,
    this.stopCount = 0,
    this.distanceKm = 0,
    this.waitMin = 0,
    this.rideMin = 0,
    this.headwayMin = 0,
    this.path = const [],
  });

  bool get isWalk => type == 'walk';

  List<LatLng> get points => path.isNotEmpty ? path.map((p) => p.point).toList() : [from, to];

  factory Leg.fromJson(Map<String, dynamic> j) {
    final f = j['from'] as Map<String, dynamic>;
    final t = j['to'] as Map<String, dynamic>;
    return Leg(
      type: j['type'],
      instruction: j['instruction'] ?? '',
      fromName: f['name'] ?? '',
      toName: t['name'] ?? '',
      from: LatLng(_d(f['lat']), _d(f['lng'])),
      to: LatLng(_d(t['lat']), _d(t['lng'])),
      toHubId: t['hubId'],
      distanceM: _i(j['distanceM']),
      durationMin: _i(j['durationMin']),
      mode: j['mode'],
      operator: j['operator'],
      lineName: j['lineName'],
      lineShortName: j['lineShortName'],
      color: j['color'],
      towards: j['towards'],
      stopCount: _i(j['stopCount']),
      distanceKm: _d(j['distanceKm']),
      waitMin: _i(j['waitMin']),
      rideMin: _i(j['rideMin']),
      headwayMin: _i(j['headwayMin']),
      path: (j['path'] as List? ?? const [])
          .map((p) => PathPoint(p['name'] ?? '', LatLng(_d(p['lat']), _d(p['lng']))))
          .toList(),
    );
  }
}

class Ticket {
  final String mode;
  final String operator;
  final double km;
  final int fare;
  const Ticket(this.mode, this.operator, this.km, this.fare);

  factory Ticket.fromJson(Map<String, dynamic> j) => Ticket(j['mode'], j['operator'], _d(j['km']), _i(j['fare']));
}

class OperatorShare {
  final String operator;
  final String operatorName;
  final String mode;
  final int standaloneFare;
  final double km;
  final double sharePct;
  final double amount;
  const OperatorShare(this.operator, this.operatorName, this.mode, this.standaloneFare, this.km, this.sharePct, this.amount);

  factory OperatorShare.fromJson(Map<String, dynamic> j) => OperatorShare(
        j['operator'],
        j['operatorName'] ?? j['operator'],
        j['mode'],
        _i(j['standaloneFare']),
        _d(j['km']),
        _d(j['sharePct']),
        _d(j['amount']),
      );
}

class FareSplit {
  final int standaloneFare;
  final int integratedFare;
  final int discountPct;
  final int savings;
  final String method;
  final List<OperatorShare> shares;
  const FareSplit(this.standaloneFare, this.integratedFare, this.discountPct, this.savings, this.method, this.shares);

  factory FareSplit.fromJson(Map<String, dynamic> j) => FareSplit(
        _i(j['standaloneFare']),
        _i(j['integratedFare']),
        _i(j['discountPct']),
        _i(j['savings']),
        j['method'] ?? '',
        (j['shares'] as List).map((e) => OperatorShare.fromJson(e)).toList(),
      );
}

class JourneyOption {
  final String id;
  final List<String> tags;
  final int totalMin;
  final int rideMin;
  final int waitMin;
  final int walkMin;
  final int walkM;
  final double distanceKm;
  final int transfers;
  final List<String> modes;
  final int fare;
  final int standaloneFare;
  final List<Ticket> tickets;
  final FareSplit fareSplit;
  final List<Leg> legs;

  const JourneyOption({
    required this.id,
    required this.tags,
    required this.totalMin,
    required this.rideMin,
    required this.waitMin,
    required this.walkMin,
    required this.walkM,
    required this.distanceKm,
    required this.transfers,
    required this.modes,
    required this.fare,
    required this.standaloneFare,
    required this.tickets,
    required this.fareSplit,
    required this.legs,
  });

  List<Leg> get rides => legs.where((l) => !l.isWalk).toList();

  factory JourneyOption.fromJson(Map<String, dynamic> j) => JourneyOption(
        id: j['id'],
        tags: _strings(j['tags']),
        totalMin: _i(j['totalMin']),
        rideMin: _i(j['rideMin']),
        waitMin: _i(j['waitMin']),
        walkMin: _i(j['walkMin']),
        walkM: _i(j['walkM']),
        distanceKm: _d(j['distanceKm']),
        transfers: _i(j['transfers']),
        modes: _strings(j['modes']),
        fare: _i(j['fare']),
        standaloneFare: _i(j['standaloneFare']),
        tickets: (j['tickets'] as List).map((e) => Ticket.fromJson(e)).toList(),
        fareSplit: FareSplit.fromJson(j['fareSplit']),
        legs: (j['legs'] as List).map((e) => Leg.fromJson(e)).toList(),
      );
}

class PlanResult {
  final String fromName;
  final String toName;
  final List<JourneyOption> options;
  const PlanResult(this.fromName, this.toName, this.options);

  factory PlanResult.fromJson(Map<String, dynamic> j) => PlanResult(
        j['from']?['name'] ?? '',
        j['to']?['name'] ?? '',
        (j['options'] as List).map((e) => JourneyOption.fromJson(e)).toList(),
      );
}

class HubMember {
  final String stopId;
  final String name;
  final String mode;
  final LatLng point;
  final List<String> lines;
  const HubMember(this.stopId, this.name, this.mode, this.point, this.lines);
}

class Hub {
  final String id;
  final String name;
  final LatLng point;
  final List<String> modes;
  final String type;
  final int lineCount;
  final int maxWalkM;
  final double maxWalkMin;
  final List<HubMember> members;

  const Hub({
    required this.id,
    required this.name,
    required this.point,
    required this.modes,
    required this.type,
    required this.lineCount,
    required this.maxWalkM,
    required this.maxWalkMin,
    required this.members,
  });

  factory Hub.fromJson(Map<String, dynamic> j) => Hub(
        id: j['id'],
        name: j['name'],
        point: LatLng(_d(j['lat']), _d(j['lng'])),
        modes: _strings(j['modes']),
        type: j['type'] ?? '',
        lineCount: _i(j['lineCount']),
        maxWalkM: _i(j['maxWalkM']),
        maxWalkMin: _d(j['maxWalkMin']),
        members: (j['members'] as List)
            .map((m) => HubMember(m['stopId'], m['name'], m['mode'], LatLng(_d(m['lat']), _d(m['lng'])), _strings(m['lines'])))
            .toList(),
      );
}

class OperatorSettlement {
  final String operator;
  final String operatorName;
  final String mode;
  final int trips;
  final double passengerKm;
  final double standaloneRevenue;
  final double settledRevenue;
  final double revenueSharePct;
  final double vsStandalone;

  const OperatorSettlement({
    required this.operator,
    required this.operatorName,
    required this.mode,
    required this.trips,
    required this.passengerKm,
    required this.standaloneRevenue,
    required this.settledRevenue,
    required this.revenueSharePct,
    required this.vsStandalone,
  });

  factory OperatorSettlement.fromJson(Map<String, dynamic> j) => OperatorSettlement(
        operator: j['operator'],
        operatorName: j['operatorName'] ?? j['operator'],
        mode: j['mode'],
        trips: _i(j['trips']),
        passengerKm: _d(j['passengerKm']),
        standaloneRevenue: _d(j['standaloneRevenue']),
        settledRevenue: _d(j['settledRevenue']),
        revenueSharePct: _d(j['revenueSharePct']),
        vsStandalone: _d(j['vsStandalone']),
      );
}

class Settlement {
  final int trips;
  final int multimodalTrips;
  final double standaloneRevenue;
  final double integratedRevenue;
  final double commuterSavings;
  final double passengerKm;
  final int integrationDiscountPct;
  final int fareWeightPct;
  final Map<String, double> costWeights;
  final List<OperatorSettlement> operators;

  const Settlement({
    required this.trips,
    required this.multimodalTrips,
    required this.standaloneRevenue,
    required this.integratedRevenue,
    required this.commuterSavings,
    required this.passengerKm,
    required this.integrationDiscountPct,
    required this.fareWeightPct,
    required this.costWeights,
    required this.operators,
  });

  factory Settlement.fromJson(Map<String, dynamic> j) {
    final rules = j['rules'] as Map<String, dynamic>? ?? const {};
    return Settlement(
      trips: _i(j['trips']),
      multimodalTrips: _i(j['multimodalTrips']),
      standaloneRevenue: _d(j['standaloneRevenue']),
      integratedRevenue: _d(j['integratedRevenue']),
      commuterSavings: _d(j['commuterSavings']),
      passengerKm: _d(j['passengerKm']),
      integrationDiscountPct: _i(rules['integrationDiscountPct']),
      fareWeightPct: _i(rules['fareWeightPct']),
      costWeights: (rules['costWeights'] as Map<String, dynamic>? ?? const {}).map((k, v) => MapEntry(k, _d(v))),
      operators: (j['operators'] as List).map((e) => OperatorSettlement.fromJson(e)).toList(),
    );
  }
}
