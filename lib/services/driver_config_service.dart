import 'dart:convert';
import 'package:logger/logger.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'api_client.dart';
import '../config/constants.dart';

class TenantConfig {
  final String tenantId;
  final String name;
  final String address;
  final double latitude;
  final double longitude;
  final bool isActive;

  const TenantConfig({
    required this.tenantId,
    required this.name,
    required this.address,
    required this.latitude,
    required this.longitude,
    required this.isActive,
  });

  factory TenantConfig.fromJson(Map<String, dynamic> json) => TenantConfig(
        tenantId: json['tenant_id'] as String? ?? '',
        name: json['name'] as String? ?? '',
        address: json['address'] as String? ?? '',
        latitude: (json['latitude'] as num?)?.toDouble() ?? 0.0,
        longitude: (json['longitude'] as num?)?.toDouble() ?? 0.0,
        isActive: json['is_active'] as bool? ?? true,
      );

  Map<String, dynamic> toJson() => {
        'tenant_id': tenantId,
        'name': name,
        'address': address,
        'latitude': latitude,
        'longitude': longitude,
        'is_active': isActive,
      };
}

/// Immutable value object representing the driver config returned by
/// GET /api/v1/driver/config
class DriverConfig {
  final TenantConfig? tenant;
  final double speedLimitKmph;
  // OTP Flags
  final bool loginBoardingOtp;
  final bool loginDeboardingOtp;
  final bool logoutBoardingOtp;
  final bool logoutDeboardingOtp;
  // Safety Flags
  final bool escortRequiredForWomen;
  final String escortRequiredStartTime;
  final String escortRequiredEndTime;
  
  final int uploadIntervalSeconds;

  const DriverConfig({
    this.tenant,
    required this.speedLimitKmph,
    required this.loginBoardingOtp,
    required this.loginDeboardingOtp,
    required this.logoutBoardingOtp,
    required this.logoutDeboardingOtp,
    required this.escortRequiredForWomen,
    required this.escortRequiredStartTime,
    required this.escortRequiredEndTime,
    required this.uploadIntervalSeconds,
  });

  factory DriverConfig.fromJson(Map<String, dynamic> json) {
    final tenantJson = json['tenant'] as Map<String, dynamic>?;
    final speed = json['speed'] as Map<String, dynamic>? ?? {};
    final otp = json['otp'] as Map<String, dynamic>? ?? {};
    final safety = json['safety'] as Map<String, dynamic>? ?? {};
    final tracking = json['tracking'] as Map<String, dynamic>? ?? {};
    final uploadInterval = json['upload_interval_seconds'] as int? ??
        tracking['upload_interval_seconds'] as int? ??
        json['upload_interval'] as int? ??
        60;

    return DriverConfig(
      tenant: tenantJson != null ? TenantConfig.fromJson(tenantJson) : null,
      speedLimitKmph:
          (speed['effective_speed_limit_kmph'] as num?)?.toDouble() ?? 
          (json['effective_speed_limit_kmph'] as num?)?.toDouble() ?? 
          (speed['speed_limit_kmph'] as num?)?.toDouble() ?? 
          (json['speed_limit_kmph'] as num?)?.toDouble() ?? 60.0,
      loginBoardingOtp: otp['login_boarding_otp'] as bool? ?? json['login_boarding_otp'] as bool? ?? false,
      loginDeboardingOtp: otp['login_deboarding_otp'] as bool? ?? json['login_deboarding_otp'] as bool? ?? false,
      logoutBoardingOtp: otp['logout_boarding_otp'] as bool? ?? json['logout_boarding_otp'] as bool? ?? false,
      logoutDeboardingOtp: otp['logout_deboarding_otp'] as bool? ?? json['logout_deboarding_otp'] as bool? ?? false,
      escortRequiredForWomen: safety['escort_required_for_women'] as bool? ?? json['escort_required_for_women'] as bool? ?? false,
      escortRequiredStartTime: safety['escort_required_start_time'] as String? ?? json['escort_required_start_time'] as String? ?? '18:00',
      escortRequiredEndTime: safety['escort_required_end_time'] as String? ?? json['escort_required_end_time'] as String? ?? '06:00',
      uploadIntervalSeconds: uploadInterval,
    );
  }

  Map<String, dynamic> toJson() => {
        'tenant': tenant?.toJson(),
        'speed_limit_kmph': speedLimitKmph,
        'login_boarding_otp': loginBoardingOtp,
        'login_deboarding_otp': loginDeboardingOtp,
        'logout_boarding_otp': logoutBoardingOtp,
        'logout_deboarding_otp': logoutDeboardingOtp,
        'escort_required_for_women': escortRequiredForWomen,
        'escort_required_start_time': escortRequiredStartTime,
        'escort_required_end_time': escortRequiredEndTime,
        'upload_interval_seconds': uploadIntervalSeconds,
      };

  static DriverConfig get defaults => const DriverConfig(
        tenant: null,
        speedLimitKmph: 60.0,
        loginBoardingOtp: false,
        loginDeboardingOtp: false,
        logoutBoardingOtp: false,
        logoutDeboardingOtp: false,
        escortRequiredForWomen: false,
        escortRequiredStartTime: '18:00',
        escortRequiredEndTime: '06:00',
        uploadIntervalSeconds: 60,
      );
}

/// Singleton service that fetches and caches the driver config.
/// Call [fetchConfig] once after successful auth; [config] always returns
/// the latest known value (falls back to cached → defaults).
class DriverConfigService {
  static final DriverConfigService _instance = DriverConfigService._internal();
  factory DriverConfigService() => _instance;
  DriverConfigService._internal();

  static const String _prefsKey = 'driver_config_cache';

  final Logger _logger = Logger();
  final ApiClient _apiClient = ApiClient();

  DriverConfig _config = DriverConfig.defaults;
  DriverConfig get config => _config;

  /// Load from local cache first for instant availability, then refresh
  /// from the API and persist the result.
  Future<void> fetchConfig() async {
    await _loadFromPrefs();

    try {
      final response =
          await _apiClient.client.get(ApiEndpoints.driverConfig);

      if (response.statusCode == 200) {
        final body = response.data as Map<String, dynamic>?;
        final data = body?['data'] as Map<String, dynamic>?;
        if (data != null) {
          _config = DriverConfig.fromJson(data);
          await _saveToPrefs(_config);
          _logger.i(
              'DriverConfig refreshed: speedLimit=${_config.speedLimitKmph} kmph, uploadInterval=${_config.uploadIntervalSeconds}s');
        } else {
          _logger.w('DriverConfig: unexpected response shape: $body');
        }
      } else {
        _logger.w('DriverConfig: HTTP ${response.statusCode}');
      }
    } catch (e) {
      _logger.w(
          'DriverConfig: failed to fetch from API, using cached/defaults — $e');
    }
  }

  Future<void> _loadFromPrefs() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final raw = prefs.getString(_prefsKey);
      if (raw != null) {
        final json = jsonDecode(raw) as Map<String, dynamic>;
        _config = DriverConfig(
          tenant: json['tenant'] != null ? TenantConfig.fromJson(json['tenant']) : null,
          speedLimitKmph:
              (json['speed_limit_kmph'] as num?)?.toDouble() ?? 60.0,
          loginBoardingOtp: json['login_boarding_otp'] as bool? ?? false,
          loginDeboardingOtp: json['login_deboarding_otp'] as bool? ?? false,
          logoutBoardingOtp: json['logout_boarding_otp'] as bool? ?? false,
          logoutDeboardingOtp: json['logout_deboarding_otp'] as bool? ?? false,
          escortRequiredForWomen: json['escort_required_for_women'] as bool? ?? false,
          escortRequiredStartTime: json['escort_required_start_time'] as String? ?? '18:00',
          escortRequiredEndTime: json['escort_required_end_time'] as String? ?? '06:00',
          uploadIntervalSeconds: json['upload_interval_seconds'] as int? ?? 60,
        );
      }
      await prefs.setInt('upload_interval_seconds', _config.uploadIntervalSeconds);
      _logger.d(
          'DriverConfig loaded from cache: speedLimit=${_config.speedLimitKmph} kmph, uploadInterval=${_config.uploadIntervalSeconds}s');
    } catch (e) {
      _logger.w('DriverConfig: failed to load cache — $e');
    }
  }

  Future<void> _saveToPrefs(DriverConfig config) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_prefsKey, jsonEncode(config.toJson()));
      await prefs.setInt('upload_interval_seconds', config.uploadIntervalSeconds);
    } catch (e) {
      _logger.w('DriverConfig: failed to save cache — $e');
    }
  }
}
