import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';

import '../theme.dart';

/// Ahmedabad + Gandhinagar default view.
const regionCenter = LatLng(23.10, 72.58);

class TransitMap extends StatelessWidget {
  final List<Polyline> polylines;
  final List<Marker> markers;
  final List<LatLng> fitPoints;
  final void Function(LatLng)? onTap;
  final void Function(LatLng center, bool byUser)? onMoved;
  final MapController? controller;
  final EdgeInsets fitPadding;

  const TransitMap({
    super.key,
    this.polylines = const [],
    this.markers = const [],
    this.fitPoints = const [],
    this.onTap,
    this.onMoved,
    this.controller,
    this.fitPadding = const EdgeInsets.all(40),
  });

  @override
  Widget build(BuildContext context) {
    final canFit = fitPoints.length >= 2;
    return Semantics(
      label: 'Map',
      child: FlutterMap(
        mapController: controller,
        options: MapOptions(
          initialCenter: fitPoints.length == 1 ? fitPoints.first : regionCenter,
          initialZoom: fitPoints.length == 1 ? 15 : 11,
          initialCameraFit: canFit ? CameraFit.bounds(bounds: LatLngBounds.fromPoints(fitPoints), padding: fitPadding) : null,
          interactionOptions: const InteractionOptions(flags: InteractiveFlag.all & ~InteractiveFlag.rotate),
          onTap: onTap == null ? null : (_, p) => onTap!(p),
          onPositionChanged: onMoved == null ? null : (camera, hasGesture) => onMoved!(camera.center, hasGesture),
        ),
        children: [
          TileLayer(
            urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
            userAgentPackageName: 'com.kaizenith.one_journey',
          ),
          if (polylines.isNotEmpty) PolylineLayer(polylines: polylines),
          if (markers.isNotEmpty) MarkerLayer(markers: markers),
          MediaQuery.withNoTextScaling(
            child: const SimpleAttributionWidget(source: Text('© OpenStreetMap contributors')),
          ),
        ],
      ),
    );
  }
}

Marker dotMarker(LatLng p, Color color, {double size = 14}) => Marker(
      point: p,
      width: size,
      height: size,
      child: Container(
        decoration: BoxDecoration(
          color: color,
          shape: BoxShape.circle,
          border: Border.all(color: AppColors.paper, width: 2),
          boxShadow: [BoxShadow(blurRadius: 3, color: AppColors.ink.withValues(alpha: 0.3))],
        ),
      ),
    );

Marker pinMarker(LatLng p, Color color, IconData icon) => Marker(
      point: p,
      width: 40,
      height: 40,
      alignment: Alignment.topCenter,
      child: Icon(icon, color: color, size: 40, shadows: [Shadow(blurRadius: 4, color: AppColors.ink.withValues(alpha: 0.45))]),
    );
