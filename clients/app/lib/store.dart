import 'package:flutter/foundation.dart';

import 'models.dart';

/// On-device state: recent searches, recent places and booked tickets.
///
/// Held in memory for the current session. This file is the only place that
/// needs to change to persist it on the phone (shared_preferences is pending approval).
class AppStore {
  AppStore._();
  static final instance = AppStore._();

  final recentTrips = RecentTrips();
  final recentPlaces = RecentPlaces();
  final tickets = MyTickets();
}

class RecentTrips extends ChangeNotifier {
  static const _max = 6;
  final List<TripRequest> _items = [];

  List<TripRequest> get items => List.unmodifiable(_items);

  void add(TripRequest trip) {
    _items.removeWhere((t) => t.sameTrip(trip));
    _items.insert(0, TripRequest(trip.from, trip.to));
    if (_items.length > _max) _items.removeLast();
    notifyListeners();
  }

  void remove(TripRequest trip) {
    _items.removeWhere((t) => t.sameTrip(trip));
    notifyListeners();
  }

  void clear() {
    _items.clear();
    notifyListeners();
  }
}

class RecentPlaces extends ChangeNotifier {
  static const _max = 8;
  final List<Place> _items = [];

  List<Place> get items => List.unmodifiable(_items);

  void add(Place place) {
    _items.removeWhere((p) => p.sameAs(place));
    _items.insert(0, place);
    if (_items.length > _max) _items.removeLast();
    notifyListeners();
  }
}

class MyTickets extends ChangeNotifier {
  final List<Ticket> _items = [];

  /// Newest first.
  List<Ticket> get items => List.unmodifiable(_items);

  void add(Ticket ticket) {
    _items.removeWhere((t) => t.id == ticket.id);
    _items.insert(0, ticket);
    notifyListeners();
  }

  /// Replaces a stored ticket with a fresher copy from the server.
  void update(Ticket ticket) {
    final i = _items.indexWhere((t) => t.id == ticket.id);
    if (i < 0) return;
    _items[i] = ticket;
    notifyListeners();
  }
}
