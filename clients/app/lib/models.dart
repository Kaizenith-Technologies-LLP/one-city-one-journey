import 'package:latlong2/latlong.dart';

double _d(dynamic v) => (v as num?)?.toDouble() ?? 0;
int _i(dynamic v) => (v as num?)?.round() ?? 0;
int? _iOrNull(dynamic v) => (v as num?)?.round();
String? _s(dynamic v) => v?.toString();
List<String> _strings(dynamic v) => (v as List? ?? const []).map((e) => e.toString()).toList();
List<Map<String, dynamic>> _maps(dynamic v) => (v as List? ?? const []).cast<Map<String, dynamic>>();

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
        distanceM: _iOrNull(j['distanceM']),
      );
}

/// A start, destination or stop along a journey: a stop, or a raw point picked on the map.
class Place {
  final String label;
  final String? stopId;
  final String? mode;
  final String? hubId;
  final LatLng point;

  const Place({required this.label, required this.point, this.stopId, this.mode, this.hubId});

  factory Place.fromStop(Stop s) => Place(label: s.name, stopId: s.id, mode: s.mode, hubId: s.hubId, point: s.latLng);

  factory Place.fromJson(Map<String, dynamic>? j) => Place(
        label: j?['name'] ?? '',
        stopId: j?['stopId'],
        mode: j?['mode'],
        hubId: j?['hubId'],
        point: LatLng(_d(j?['lat']), _d(j?['lng'])),
      );

  /// Value accepted by /api/plan and /api/tickets: a stop id or "lat,lng".
  String get query => stopId ?? '${point.latitude.toStringAsFixed(6)},${point.longitude.toStringAsFixed(6)}';

  bool sameAs(Place other) => query == other.query;
}

/// What the user asked for: from, to and an optional departure ("HH:MM"; null = leave now).
class TripRequest {
  final Place from;
  final Place to;
  final String? depart;
  const TripRequest(this.from, this.to, {this.depart});

  TripRequest withDepart(String? value) => TripRequest(from, to, depart: value);
  TripRequest swapped() => TripRequest(to, from, depart: depart);

  bool sameTrip(TripRequest other) => from.sameAs(other.from) && to.sameAs(other.to);
}

class PathPoint {
  final String? stopId;
  final String name;
  final LatLng point;
  const PathPoint(this.stopId, this.name, this.point);
}

class Leg {
  final String type; // walk | ride
  final String? kind; // walk: access | transfer | egress
  final String instruction;
  final Place from;
  final Place to;
  final String departTime;
  final String arriveTime;
  // walk
  final int distanceM;
  final int durationMin;
  final String? heatWarning;
  // ride
  final String? mode;
  final String? operator;
  final String? lineId;
  final String? lineName;
  final String? lineShortName;
  final String? towards;
  final int stopCount;
  final double distanceKm;
  final int waitMin;
  final int rideMin;
  final int? headwayMin;
  final List<PathPoint> path;

  const Leg({
    required this.type,
    required this.instruction,
    required this.from,
    required this.to,
    required this.departTime,
    required this.arriveTime,
    this.kind,
    this.distanceM = 0,
    this.durationMin = 0,
    this.heatWarning,
    this.mode,
    this.operator,
    this.lineId,
    this.lineName,
    this.lineShortName,
    this.towards,
    this.stopCount = 0,
    this.distanceKm = 0,
    this.waitMin = 0,
    this.rideMin = 0,
    this.headwayMin,
    this.path = const [],
  });

  bool get isWalk => type == 'walk';
  bool get isTransfer => kind == 'transfer';

  List<LatLng> get points => path.isNotEmpty ? path.map((p) => p.point).toList() : [from.point, to.point];

  /// Stops passed between boarding and alighting.
  List<PathPoint> get intermediateStops => path.length > 2 ? path.sublist(1, path.length - 1) : const [];

  factory Leg.fromJson(Map<String, dynamic> j) => Leg(
        type: j['type'] ?? 'walk',
        kind: j['kind'],
        instruction: j['instruction'] ?? '',
        from: Place.fromJson(j['from']),
        to: Place.fromJson(j['to']),
        departTime: j['departTime'] ?? '',
        arriveTime: j['arriveTime'] ?? '',
        distanceM: _i(j['distanceM']),
        durationMin: _i(j['durationMin']),
        heatWarning: _s(j['heatWarning']),
        mode: j['mode'],
        operator: j['operator'],
        lineId: j['lineId'],
        lineName: j['lineName'],
        lineShortName: j['lineShortName'],
        towards: j['towards'],
        stopCount: _i(j['stopCount']),
        distanceKm: _d(j['distanceKm']),
        waitMin: _i(j['waitMin']),
        rideMin: _i(j['rideMin']),
        headwayMin: _iOrNull(j['headwayMin']),
        path: _maps(j['path'])
            .map((p) => PathPoint(p['stopId'], p['name'] ?? '', LatLng(_d(p['lat']), _d(p['lng']))))
            .toList(),
      );
}

/// One operator's standalone ticket for part of a journey.
class LegFare {
  final String mode;
  final String operator;
  final double km;
  final int fare;
  const LegFare(this.mode, this.operator, this.km, this.fare);

  factory LegFare.fromJson(Map<String, dynamic> j) => LegFare(j['mode'] ?? '', j['operator'] ?? '', _d(j['km']), _i(j['fare']));
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
        j['operator'] ?? '',
        j['operatorName'] ?? j['operator'] ?? '',
        j['mode'] ?? '',
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

  factory FareSplit.fromJson(Map<String, dynamic>? j) => FareSplit(
        _i(j?['standaloneFare']),
        _i(j?['integratedFare']),
        _i(j?['discountPct']),
        _i(j?['savings']),
        j?['method'] ?? '',
        _maps(j?['shares']).map(OperatorShare.fromJson).toList(),
      );
}

class JourneyOption {
  final String id;
  final List<String> tags;
  final String? reason;
  final String signature;
  final String leaveTime;
  final String arriveTime;
  final int totalMin;
  final int rideMin;
  final int waitMin;
  final int walkMin;
  final int walkM;
  final double distanceKm;
  final int transfers;
  final List<String> modes;
  final List<String> operators;
  final int fare;
  final int standaloneFare;
  final List<LegFare> tickets;
  final FareSplit fareSplit;
  final List<Leg> legs;

  const JourneyOption({
    required this.id,
    required this.tags,
    required this.reason,
    required this.signature,
    required this.leaveTime,
    required this.arriveTime,
    required this.totalMin,
    required this.rideMin,
    required this.waitMin,
    required this.walkMin,
    required this.walkM,
    required this.distanceKm,
    required this.transfers,
    required this.modes,
    required this.operators,
    required this.fare,
    required this.standaloneFare,
    required this.tickets,
    required this.fareSplit,
    required this.legs,
  });

  bool get isRecommended => tags.contains('recommended');
  List<Leg> get rides => legs.where((l) => !l.isWalk).toList();
  int get savings => fareSplit.savings;

  factory JourneyOption.fromJson(Map<String, dynamic> j) => JourneyOption(
        id: j['id'] ?? '',
        tags: _strings(j['tags']),
        reason: _s(j['reason']),
        signature: j['signature'] ?? '',
        leaveTime: j['leaveTime'] ?? '',
        arriveTime: j['arriveTime'] ?? '',
        totalMin: _i(j['totalMin']),
        rideMin: _i(j['rideMin']),
        waitMin: _i(j['waitMin']),
        walkMin: _i(j['walkMin']),
        walkM: _i(j['walkM']),
        distanceKm: _d(j['distanceKm']),
        transfers: _i(j['transfers']),
        modes: _strings(j['modes']),
        operators: _strings(j['operators']),
        fare: _i(j['fare']),
        standaloneFare: _i(j['standaloneFare']),
        tickets: _maps(j['tickets']).map(LegFare.fromJson).toList(),
        fareSplit: FareSplit.fromJson(j['fareSplit']),
        legs: _maps(j['legs']).map(Leg.fromJson).toList(),
      );
}

/// A line that cannot be boarded around the requested time.
class NotRunningLine {
  final String lineId;
  final String name;
  final String mode;
  final String status; // ended | notStarted | noServiceToday
  final String? lastDeparture;
  final String? firstDeparture;

  const NotRunningLine({
    required this.lineId,
    required this.name,
    required this.mode,
    required this.status,
    this.lastDeparture,
    this.firstDeparture,
  });

  String get explanation => switch (status) {
        'ended' => lastDeparture == null ? 'Finished for today' : 'Last departure left at $lastDeparture',
        'notStarted' => firstDeparture == null ? 'Not started yet' : 'First departure at $firstDeparture',
        _ => 'No service today',
      };

  factory NotRunningLine.fromJson(Map<String, dynamic> j) => NotRunningLine(
        lineId: j['lineId'] ?? '',
        name: j['name'] ?? '',
        mode: j['mode'] ?? '',
        status: j['status'] ?? '',
        lastDeparture: _s(j['lastDeparture']),
        firstDeparture: _s(j['firstDeparture']),
      );
}

/// A closure of a line, a section or a stop, with advisories in English, Gujarati and Hindi.
class Disruption {
  final String id;
  final String type; // line | section | stop
  final String title;
  final String status;
  final DateTime? startsAt;
  final DateTime? endsAt;
  final String en;
  final String gu;
  final String hi;
  final String whatsapp;
  final List<String> affectedLines;

  const Disruption({
    required this.id,
    required this.type,
    required this.title,
    required this.status,
    required this.startsAt,
    required this.endsAt,
    required this.en,
    required this.gu,
    required this.hi,
    required this.whatsapp,
    required this.affectedLines,
  });

  /// Advisory text for a language code (en, gu, hi), falling back to English.
  String text(String lang) {
    final t = switch (lang) { 'gu' => gu, 'hi' => hi, _ => en };
    return t.isEmpty ? en : t;
  }

  bool get isActive => status == 'active';

  factory Disruption.fromJson(Map<String, dynamic> j) => Disruption(
        id: j['id']?.toString() ?? '',
        type: j['type'] ?? '',
        title: j['title'] ?? '',
        status: j['status'] ?? '',
        startsAt: DateTime.tryParse(j['startsAt']?.toString() ?? '')?.toLocal(),
        endsAt: DateTime.tryParse(j['endsAt']?.toString() ?? '')?.toLocal(),
        en: j['en']?.toString() ?? '',
        gu: j['gu']?.toString() ?? '',
        hi: j['hi']?.toString() ?? '',
        whatsapp: j['whatsapp']?.toString() ?? '',
        affectedLines: _strings(j['affectedLines']),
      );
}

class Weather {
  final String? time;
  final double tempC;
  final double feelsLikeC;
  final double precipMm;
  final String source;
  final bool heatMode;

  const Weather({
    required this.time,
    required this.tempC,
    required this.feelsLikeC,
    required this.precipMm,
    required this.source,
    required this.heatMode,
  });

  static Weather? fromJsonOrNull(dynamic j) => j is Map<String, dynamic>
      ? Weather(
          time: _s(j['time']),
          tempC: _d(j['tempC']),
          feelsLikeC: _d(j['feelsLikeC']),
          precipMm: _d(j['precipMm']),
          source: j['source']?.toString() ?? '',
          heatMode: j['heatMode'] == true,
        )
      : null;
}

class WeatherNow {
  final Weather? now;
  final double? thresholdC;
  const WeatherNow(this.now, this.thresholdC);

  factory WeatherNow.fromJson(Map<String, dynamic>? j) =>
      WeatherNow(Weather.fromJsonOrNull(j?['now']), (j?['thresholdC'] as num?)?.toDouble());
}

class PlanResult {
  final Place from;
  final Place to;
  final String departAt;
  final String day;
  /// The exact time the options were planned for; booking re-plans at this time.
  final String departIso;
  /// True when nothing ran at the requested time and these are the next day's first trips.
  final bool nextDay;
  final String? requestedDepartAt;
  final List<NotRunningLine> notRunning;
  final List<Disruption> disruptions;
  final Weather? weather;
  final List<JourneyOption> options;

  const PlanResult({
    required this.from,
    required this.to,
    required this.departAt,
    required this.day,
    required this.departIso,
    required this.nextDay,
    required this.requestedDepartAt,
    required this.notRunning,
    required this.disruptions,
    required this.weather,
    required this.options,
  });

  /// Departure value to send when booking or re-planning these exact options.
  String get bookingDepart => departIso.isNotEmpty ? departIso : departAt;

  factory PlanResult.fromJson(Map<String, dynamic> j) => PlanResult(
        from: Place.fromJson(j['from']),
        to: Place.fromJson(j['to']),
        departAt: j['departAt'] ?? '',
        day: j['day'] ?? '',
        departIso: j['departIso'] ?? '',
        nextDay: j['nextDay'] == true,
        requestedDepartAt: j['requestedDepartAt'],
        notRunning: _maps(j['notRunning']).map(NotRunningLine.fromJson).toList(),
        disruptions: _maps(j['disruptions']).map(Disruption.fromJson).toList(),
        weather: Weather.fromJsonOrNull(j['weather']),
        options: _maps(j['options']).map(JourneyOption.fromJson).toList(),
      );
}

/// A ride on an issued ticket.
class TicketLeg {
  final String mode;
  final String? line;
  final String? lineName;
  final String from;
  final String to;
  final int stops;
  final double distanceKm;
  final String? departTime;
  final String? arriveTime;

  const TicketLeg({
    required this.mode,
    required this.from,
    required this.to,
    this.line,
    this.lineName,
    this.stops = 0,
    this.distanceKm = 0,
    this.departTime,
    this.arriveTime,
  });

  factory TicketLeg.fromJson(Map<String, dynamic> j) => TicketLeg(
        mode: j['mode'] ?? '',
        line: _s(j['line']),
        lineName: _s(j['lineName']),
        from: j['from']?.toString() ?? '',
        to: j['to']?.toString() ?? '',
        stops: _i(j['stops']),
        distanceKm: _d(j['distanceKm']),
        departTime: _s(j['departTime']),
        arriveTime: _s(j['arriveTime']),
      );
}

/// An integrated ticket issued by POST /api/tickets.
class Ticket {
  final String id;
  final String status; // active | used | cancelled | expired
  final int fare;
  final int standaloneFare;
  final int savings;
  final Place from;
  final Place to;
  final String? signature;
  final int totalMin;
  final int transfers;
  final List<String> modes;
  final List<String> operators;
  final List<OperatorShare> split;
  final List<TicketLeg> legs;
  final String qr;
  final DateTime? createdAt;
  final DateTime? validUntil;

  const Ticket({
    required this.id,
    required this.status,
    required this.fare,
    required this.standaloneFare,
    required this.savings,
    required this.from,
    required this.to,
    required this.signature,
    required this.totalMin,
    required this.transfers,
    required this.modes,
    required this.operators,
    required this.split,
    required this.legs,
    required this.qr,
    required this.createdAt,
    required this.validUntil,
  });

  /// Status as of [now]: an active ticket past its validity reads as expired.
  String statusAt(DateTime now) =>
      status == 'active' && validUntil != null && now.isAfter(validUntil!) ? 'expired' : status;

  factory Ticket.fromJson(Map<String, dynamic> j) => Ticket(
        id: j['id'] ?? '',
        status: j['status'] ?? '',
        fare: _i(j['fare']),
        standaloneFare: _i(j['standaloneFare']),
        savings: _i(j['savings']),
        from: Place.fromJson(j['from']),
        to: Place.fromJson(j['to']),
        signature: _s(j['signature']),
        totalMin: _i(j['totalMin']),
        transfers: _i(j['transfers']),
        modes: _strings(j['modes']),
        operators: _strings(j['operators']),
        split: _maps(j['split']).map(OperatorShare.fromJson).toList(),
        legs: _maps(j['legs']).map(TicketLeg.fromJson).toList(),
        qr: j['qr']?.toString() ?? '',
        createdAt: DateTime.tryParse(j['createdAt']?.toString() ?? '')?.toLocal(),
        validUntil: DateTime.tryParse(j['validUntil']?.toString() ?? '')?.toLocal(),
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
        id: j['id'] ?? '',
        name: j['name'] ?? '',
        point: LatLng(_d(j['lat']), _d(j['lng'])),
        modes: _strings(j['modes']),
        type: j['type'] ?? '',
        lineCount: _i(j['lineCount']),
        maxWalkM: _i(j['maxWalkM']),
        maxWalkMin: _d(j['maxWalkMin']),
        members: _maps(j['members'])
            .map((m) => HubMember(m['stopId'] ?? '', m['name'] ?? '', m['mode'] ?? '', LatLng(_d(m['lat']), _d(m['lng'])), _strings(m['lines'])))
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
        operator: j['operator'] ?? '',
        operatorName: j['operatorName'] ?? j['operator'] ?? '',
        mode: j['mode'] ?? '',
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
      operators: _maps(j['operators']).map(OperatorSettlement.fromJson).toList(),
    );
  }
}
