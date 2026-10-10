import 'package:flutter/foundation.dart';

/// Base URL of the One Journey API.
///
/// Override at build time: `flutter run --dart-define=API_BASE=http://192.168.1.5:4000/api`
/// Defaults: the Android emulator reaches the host machine via 10.0.2.2; web and iOS use localhost.
class AppConfig {
  static const _fromEnv = String.fromEnvironment('API_BASE');

  static String get apiBase {
    if (_fromEnv.isNotEmpty) return _fromEnv;
    if (!kIsWeb && defaultTargetPlatform == TargetPlatform.android) {
      return 'http://10.0.2.2:4000/api';
    }
    return 'http://localhost:4000/api';
  }
}
