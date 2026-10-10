import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';

/// Ahmedabad + Gandhinagar default view.
const regionCenter = LatLng(23.10, 72.58);

class TransitMap extends StatelessWidget {
  final List<Polyline> polylines;
  final List<Marker> markers;
  final List<LatLng> fitPoints;
  final void Function(LatLng)? onTap;
  final MapController? controller;

  const TransitMap({
    super.key,
    this.polylines = const [],
    this.markers = const [],
    this.fitPoints = const [],
    this.onTap,
    this.controller,
  });

  @override
  Widget build(BuildContext context) {
    final canFit = fitPoints.length >= 2;
    return FlutterMap(
      mapController: controller,
      options: MapOptions(
        initialCenter: fitPoints.length == 1 ? fitPoints.first : regionCenter,
        initialZoom: fitPoints.length == 1 ? 15 : 11,
        initialCameraFit: canFit
            ? CameraFit.bounds(bounds: LatLngBounds.fromPoints(fitPoints), padding: const EdgeInsets.all(40))
            : null,
        onTap: onTap == null ? null : (_, p) => onTap!(p),
      ),
      children: [
        TileLayer(
          urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
          userAgentPackageName: 'com.kaizenith.one_journey',
        ),
        if (polylines.isNotEmpty) PolylineLayer(polylines: polylines),
        if (markers.isNotEmpty) MarkerLayer(markers: markers),
        const SimpleAttributionWidget(source: Text('OpenStreetMap contributors')),
      ],
    );
  }
}

Marker dotMarker(LatLng p, Color color, {double size = 14, Widget? child}) => Marker(
      point: p,
      width: size,
      height: size,
      child: child ??
          Container(
            decoration: BoxDecoration(
              color: color,
              shape: BoxShape.circle,
              border: Border.all(color: Colors.white, width: 2),
              boxShadow: const [BoxShadow(blurRadius: 3, color: Colors.black26)],
            ),
          ),
    );

Marker pinMarker(LatLng p, Color color, IconData icon) => Marker(
      point: p,
      width: 36,
      height: 36,
      alignment: Alignment.topCenter,
      child: Icon(icon, color: color, size: 36, shadows: const [Shadow(blurRadius: 4, color: Colors.black38)]),
    );
