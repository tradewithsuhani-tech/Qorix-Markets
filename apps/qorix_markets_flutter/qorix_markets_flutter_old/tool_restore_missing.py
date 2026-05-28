#!/usr/bin/env python3
"""Generate missing Dart files for recovered Qorix Flutter app."""
from pathlib import Path

ROOT = Path(__file__).resolve().parent / "lib"

def w(rel: str, content: str) -> None:
    path = ROOT / rel
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content.strip() + "\n", encoding="utf-8")
    print(f"  + {rel}")

FILES: dict[str, str] = {}

# ── Theme ──────────────────────────────────────────────────────────────────────
FILES["core/theme/app_colors.dart"] = '''
import 'package:flutter/material.dart';

abstract final class AppColors {
  static const brand = Color(0xFF8B5CF6);
  static const buy = Color(0xFF22C55E);
  static const sell = Color(0xFFEF4444);
  static const emerald = Color(0xFF10B981);
  static const warning = Color(0xFFF59E0B);
  static const darkBg = Color(0xFF0B1014);
  static const darkElevated = Color(0xFF161D28);
  static const darkBorder = Color(0xFF1E2630);
  static const lightBg = Color(0xFFF8FAFC);
  static const lightBgSecondary = Color(0xFFE2E8F0);
  static const lightElevated = Color(0xFFFFFFFF);
  static const lightSurface = Color(0xFFF1F5F9);
  static const authPageBg = Color(0xFF0A0E12);
  static const authCardBg = Color(0xFF12171C);
  static const authInputBg = Color(0xFF0E1217);
  static const authInputBorder = Color(0xFF252D38);
  static const authMuted = Color(0xFF94A3B8);
  static const authGreen = Color(0xFF10B981);
  static const authGreenDark = Color(0xFF059669);
  static const authGreenLight = Color(0xFF34D399);
  static const authGold = Color(0xFFEAB308);
  static const authGoldLight = Color(0xFFFDE047);
  static const neonGreen = Color(0xFF22FF88);
  static const brandGradient = LinearGradient(
    begin: Alignment.centerLeft,
    end: Alignment.centerRight,
    colors: [Color(0xFF3B82F6), Color(0xFF8B5CF6), Color(0xFFEC4899)],
  );
  static const authGreenGradient = LinearGradient(
    colors: [authGreenDark, authGreen, authGreenLight],
  );
  static const authGoldGradient = LinearGradient(
    colors: [Color(0xFFCA8A04), authGold, authGoldLight],
  );

  static Color surface(bool isDark) => isDark ? darkElevated : lightSurface;
  static Color card(bool isDark) => isDark ? const Color(0xFF11161E) : Colors.white;
  static Color muted(bool isDark) => isDark ? authMuted : const Color(0xFF64748B);
  static Color textPrimary(bool isDark) => isDark ? const Color(0xFFF9FAFB) : const Color(0xFF0F172A);
  static Color border(bool isDark) => isDark ? darkBorder : const Color(0xFFCBD5E1);
  static Color brandGlow([double a = 0.35]) => brand.withValues(alpha: a);
  static Color buyGlow([double a = 0.12]) => buy.withValues(alpha: a);
  static Color neonGlow([double a = 0.2]) => neonGreen.withValues(alpha: a);
  static Color emeraldGlowShadow([double a = 0.04]) => emerald.withValues(alpha: a);
}
'''

FILES["core/theme/app_radius.dart"] = '''
import 'package:flutter/material.dart';

abstract final class AppRadius {
  static const double xs = 6;
  static const double sm = 8;
  static const double md = 12;
  static const double lg = 16;
  static const double xl = 20;
  static const double xxl = 24;
  static const double pill = 999;

  static const xsAll = BorderRadius.all(Radius.circular(xs));
  static const smAll = BorderRadius.all(Radius.circular(sm));
  static const mdAll = BorderRadius.all(Radius.circular(md));
  static const lgAll = BorderRadius.all(Radius.circular(lg));
  static const xlAll = BorderRadius.all(Radius.circular(xl));
  static const xxlAll = BorderRadius.all(Radius.circular(xxl));
  static const pillAll = BorderRadius.all(Radius.circular(pill));
}
'''

FILES["core/theme/app_typography.dart"] = '''
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import 'package:qorix_markets_flutter/core/theme/app_colors.dart';

abstract final class AppTypography {
  static TextTheme build({required bool isDark}) {
    final base = GoogleFonts.interTextTheme();
    final color = AppColors.textPrimary(isDark);
    return base.apply(bodyColor: color, displayColor: color);
  }
}
'''

FILES["core/theme/theme_mode_provider.dart"] = '''
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

final themeModeProvider = StateProvider<ThemeMode>((ref) => ThemeMode.dark);
'''

# ── Errors / infra ─────────────────────────────────────────────────────────────
FILES["core/errors/failures.dart"] = '''
import 'package:equatable/equatable.dart';

sealed class Failure extends Equatable {
  const Failure(this.message);
  final String message;
  @override
  List<Object?> get props => [message];
}

final class NetworkFailure extends Failure {
  const NetworkFailure(super.message);
}

final class AuthFailure extends Failure {
  const AuthFailure(super.message);
}

final class ServerFailure extends Failure {
  const ServerFailure(super.message);
}
'''

FILES["core/errors/exceptions.dart"] = '''
class AppException implements Exception {
  const AppException(this.message);
  final String message;
  @override
  String toString() => message;
}

class NetworkException extends AppException {
  const NetworkException(super.message);
}

class AuthException extends AppException {
  const AuthException(super.message);
}

class ServerException extends AppException {
  const ServerException(super.message, {this.statusCode});
  final int? statusCode;
}

class ValidationException extends AppException {
  const ValidationException(super.message);
}

class WriteApiBlockedException extends AppException {
  const WriteApiBlockedException(super.message);
}
'''

FILES["core/qa/ux_copy.dart"] = '''
abstract final class UxCopy {
  static const capitalProtected = 'Capital protected';
  static const retrySecurely = 'Retry securely';
  static const connectionInterrupted = 'Connection interrupted. Your funds are safe.';
  static const requestIncomplete = 'Request could not be completed.';
  static const systemsBusy = 'Systems are busy. Try again shortly.';
  static const sessionExpired = 'Session expired. Sign in again.';
  static const biometricPrepTitle = 'Enable biometric unlock';
  static const biometricPrepMessage = 'Use Face ID or fingerprint for faster, secure access.';
}
'''

FILES["core/application/cached_async_mixin.dart"] = '''
import 'package:flutter_riverpod/flutter_riverpod.dart';

mixin CachedAsyncMixin<T> on AsyncNotifier<T> {
  T? _cached;
  T? get cachedValue => _cached;
  void cacheValue(T value) => _cached = value;

  Future<void> softRefresh(Future<T> Function() fetch) async {
    final previous = _cached;
    state = const AsyncLoading();
    try {
      final data = await fetch();
      cacheValue(data);
      state = AsyncData(data);
    } catch (e, st) {
      if (previous != null) {
        state = AsyncData(previous);
      } else {
        state = AsyncError(e, st);
      }
    }
  }
}
'''

FILES["core/config/feature_flags.dart"] = '''
abstract final class FeatureFlags {
  static const bool pushNotifications = true;
  static const bool appLock = true;
}
'''

FILES["core/connectivity/connectivity_service.dart"] = '''
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

final connectivityServiceProvider = Provider<Connectivity>((ref) => Connectivity());

final isOnlineProvider = StreamProvider<bool>((ref) async* {
  final connectivity = ref.watch(connectivityServiceProvider);
  await for (final result in connectivity.onConnectivityChanged) {
    yield result != ConnectivityResult.none;
  }
});
'''

FILES["core/infrastructure/device_fingerprint_service.dart"] = '''
import 'dart:io';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import 'package:qorix_markets_flutter/core/constants/app_constants.dart';

final deviceFingerprintProvider = Provider<DeviceFingerprintService>((ref) {
  return DeviceFingerprintService(const FlutterSecureStorage());
});

class DeviceFingerprintService {
  DeviceFingerprintService(this._storage);
  final FlutterSecureStorage _storage;

  Future<String> getDeviceId() async {
    var id = await _storage.read(key: AppConstants.storageDeviceId);
    if (id != null && id.isNotEmpty) return id;
    id = '${Platform.operatingSystem}-${DateTime.now().millisecondsSinceEpoch}';
    await _storage.write(key: AppConstants.storageDeviceId, value: id);
    return id;
  }

  Future<Map<String, String>> headers() async => {
        'X-Device-Id': await getDeviceId(),
        'X-Platform': Platform.operatingSystem,
      };
}
'''

FILES["core/motion/device_motion.dart"] = '''
import 'package:flutter/material.dart';

abstract final class DeviceMotion {
  static bool get prefersReducedMotion =>
      WidgetsBinding.instance.platformDispatcher.accessibilityFeatures.disableAnimations;
}
'''

FILES["core/motion/haptics.dart"] = '''
import 'package:flutter/services.dart';

import 'package:qorix_markets_flutter/core/motion/device_motion.dart';

abstract final class AppHaptics {
  static void light() {
    if (DeviceMotion.prefersReducedMotion) return;
    HapticFeedback.lightImpact();
  }

  static void selection() {
    if (DeviceMotion.prefersReducedMotion) return;
    HapticFeedback.selectionClick();
  }

  static void success() {
    if (DeviceMotion.prefersReducedMotion) return;
    HapticFeedback.mediumImpact();
  }
}
'''

FILES["core/motion/sensory_feedback.dart"] = '''
import 'package:qorix_markets_flutter/core/motion/haptics.dart';

abstract final class SensoryFeedback {
  static void celebrate() => AppHaptics.success();
  static void tap() => AppHaptics.light();
}
'''

FILES["core/observability/logging_service.dart"] = '''
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

final loggingServiceProvider = Provider<LoggingService>((ref) => LoggingService());

class LoggingService {
  void info(String tag, String message) {
    if (kDebugMode) debugPrint('[$tag] $message');
  }

  void error(String tag, String message, [Object? error, StackTrace? stack]) {
    if (kDebugMode) debugPrint('[$tag] $message $error $stack');
  }
}
'''

FILES["core/observability/analytics_events.dart"] = '''
abstract final class AnalyticsEvents {
  static const appLaunch = 'app_launch';
  static const login = 'login_success';
}
'''

FILES["core/observability/analytics_service.dart"] = '''
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:qorix_markets_flutter/core/observability/logging_service.dart';

final analyticsServiceProvider = Provider<AnalyticsService>((ref) {
  return AnalyticsService(ref.watch(loggingServiceProvider));
});

class AnalyticsService {
  AnalyticsService(this._log);
  final LoggingService _log;

  void appLaunch() => _log.info('Analytics', 'app_launch');
  void track(String event, [Map<String, Object?>? props]) {
    _log.info('Analytics', '$event $props');
  }
}
'''

FILES["core/observability/crash_reporting_service.dart"] = '''
import 'package:flutter_riverpod/flutter_riverpod.dart';

final crashReportingServiceProvider = Provider<CrashReportingService>((ref) => CrashReportingService());

class CrashReportingService {
  Future<void> initialize() async {}

  void recordError(Object error, StackTrace stack, {String? context}) {}
}
'''

FILES["core/security/auth_token_guard.dart"] = '''
abstract final class AuthTokenGuard {
  static bool isExpired(String? token) => false;
}
'''

FILES["services/storage/secure_storage_service.dart"] = '''
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import 'package:qorix_markets_flutter/core/constants/app_constants.dart';

final secureStorageProvider = Provider<SecureStorageService>((ref) {
  return SecureStorageService(const FlutterSecureStorage());
});

class SecureStorageService {
  SecureStorageService(this._storage);
  final FlutterSecureStorage _storage;

  Future<String?> read(String key) => _storage.read(key: key);
  Future<void> write(String key, String value) => _storage.write(key: key, value: value);
  Future<void> delete(String key) => _storage.delete(key: key);

  Future<String?> getAccessToken() => read(AppConstants.storageAccessToken);
  Future<String?> getRefreshToken() => read(AppConstants.storageRefreshToken);

  Future<void> saveTokens({required String access, required String refresh}) async {
    await write(AppConstants.storageAccessToken, access);
    await write(AppConstants.storageRefreshToken, refresh);
  }

  Future<bool> hasSession() async {
    final t = await getAccessToken();
    return t != null && t.isNotEmpty;
  }

  Future<void> clearSession() async {
    await delete(AppConstants.storageAccessToken);
    await delete(AppConstants.storageRefreshToken);
  }
}
'''

FILES["services/websocket/websocket_service.dart"] = '''
import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:web_socket_channel/web_socket_channel.dart';

import 'package:qorix_markets_flutter/core/config/env_config.dart';

enum WsConnectionState { connecting, connected, disconnected, error }

final webSocketServiceProvider = Provider<WebSocketService>((ref) => WebSocketService());

class WebSocketService {
  WebSocketChannel? _channel;
  final _state = StreamController<WsConnectionState>.broadcast();
  final _messages = StreamController<Map<String, dynamic>>.broadcast();

  Stream<WsConnectionState> get connectionState => _state.stream;
  Stream<Map<String, dynamic>> get messages => _messages.stream;

  void connect() {
    _state.add(WsConnectionState.connecting);
    try {
      _channel = WebSocketChannel.connect(Uri.parse(EnvConfig.wsBaseUrl));
      _state.add(WsConnectionState.connected);
      _channel!.stream.listen(
        (data) {
          if (data is Map<String, dynamic>) _messages.add(data);
        },
        onError: (_) => _state.add(WsConnectionState.error),
        onDone: () => _state.add(WsConnectionState.disconnected),
      );
    } catch (_) {
      _state.add(WsConnectionState.error);
    }
  }

  void disconnect() {
    _channel?.sink.close();
    _channel = null;
    _state.add(WsConnectionState.disconnected);
  }
}
'''

FILES["services/notifications/push_notification_service.dart"] = '''
import 'package:flutter_riverpod/flutter_riverpod.dart';

final pushNotificationServiceProvider = Provider<PushNotificationService>((ref) {
  return PushNotificationService();
});

class PushNotificationService {
  Future<void> initialize() async {}
}
'''

FILES["routes/root_navigator.dart"] = '''
import 'package:flutter/material.dart';

final rootNavigatorKey = GlobalKey<NavigatorState>();
'''

FILES["shared/formatters/currency_formatter.dart"] = '''
import 'package:intl/intl.dart';

abstract final class CurrencyFormatter {
  static final _usd = NumberFormat.currency(symbol: r'$', decimalDigits: 2);
  static final _inr = NumberFormat.currency(symbol: '₹', decimalDigits: 0);

  static String usd(num value) => _usd.format(value);
  static String inr(num value) => _inr.format(value);
  static String compact(num value) {
    if (value.abs() >= 1000000) return '${(value / 1000000).toStringAsFixed(1)}M';
    if (value.abs() >= 1000) return '${(value / 1000).toStringAsFixed(1)}K';
    return value.toStringAsFixed(2);
  }
}
'''

# ── Data models ────────────────────────────────────────────────────────────────
FILES["data/models/user_model.dart"] = '''
import 'package:qorix_markets_flutter/core/network/api_json.dart';
import 'package:qorix_markets_flutter/features/auth/domain/entities/user_entity.dart';

class UserModel {
  const UserModel({
    required this.id,
    required this.email,
    this.fullName,
    this.kycVerified = false,
    this.phone,
    this.emailVerified = false,
    this.phoneVerified = false,
    this.twoFactorEnabled = false,
    this.vipTier,
    this.isPro = false,
  });

  factory UserModel.fromJson(Map<String, dynamic> json) {
    final root = ApiJson.object(json['user'] ?? json);
    return UserModel(
      id: root['id']?.toString() ?? '',
      email: root['email'] as String? ?? '',
      fullName: root['fullName'] as String? ?? root['name'] as String?,
      kycVerified: root['kycVerified'] as bool? ?? false,
      phone: root['phone'] as String?,
      emailVerified: root['emailVerified'] as bool? ?? false,
      phoneVerified: root['phoneVerified'] as bool? ?? false,
      twoFactorEnabled: root['twoFactorEnabled'] as bool? ?? false,
      vipTier: root['vipTier'] as String?,
      isPro: root['isPro'] as bool? ?? false,
    );
  }

  final String id;
  final String email;
  final String? fullName;
  final bool kycVerified;
  final String? phone;
  final bool emailVerified;
  final bool phoneVerified;
  final bool twoFactorEnabled;
  final String? vipTier;
  final bool isPro;

  UserEntity toEntity() => UserEntity(
        id: id,
        email: email,
        fullName: fullName,
        kycVerified: kycVerified,
        phone: phone,
        emailVerified: emailVerified,
        phoneVerified: phoneVerified,
        twoFactorEnabled: twoFactorEnabled,
        vipTier: vipTier,
        isPro: isPro,
      );
}
'''

FILES["data/models/auth_response_model.dart"] = '''
import 'package:qorix_markets_flutter/core/network/api_json.dart';
import 'package:qorix_markets_flutter/data/models/user_model.dart';

class AuthResponseModel {
  const AuthResponseModel({required this.accessToken, required this.refreshToken, required this.user});

  factory AuthResponseModel.fromJson(Map<String, dynamic> json) {
    final root = ApiJson.object(json);
    return AuthResponseModel(
      accessToken: root['accessToken'] as String? ?? root['token'] as String? ?? '',
      refreshToken: root['refreshToken'] as String? ?? '',
      user: UserModel.fromJson(root),
    );
  }

  final String accessToken;
  final String refreshToken;
  final UserModel user;
}
'''

FILES["data/models/trade_model.dart"] = '''
import 'package:qorix_markets_flutter/core/network/api_json.dart';

class TradeModel {
  const TradeModel({
    required this.id,
    required this.symbol,
    required this.direction,
    required this.entryPrice,
    required this.exitPrice,
    required this.profit,
    required this.profitPercent,
    required this.executedAt,
  });

  factory TradeModel.fromJson(Map<String, dynamic> json) {
    return TradeModel(
      id: (json['id'] as num?)?.toInt() ?? 0,
      symbol: json['symbol'] as String? ?? 'UNKNOWN',
      direction: json['direction'] as String? ?? 'long',
      entryPrice: ApiJson.asDouble(json['entryPrice']),
      exitPrice: ApiJson.asDouble(json['exitPrice']),
      profit: ApiJson.asDouble(json['profit']),
      profitPercent: ApiJson.asDouble(json['profitPercent']),
      executedAt: json['executedAt'] as String? ?? DateTime.now().toIso8601String(),
    );
  }

  final int id;
  final String symbol;
  final String direction;
  final double entryPrice;
  final double exitPrice;
  final double profit;
  final double profitPercent;
  final String executedAt;
}
'''

FILES["data/models/deposit_model.dart"] = '''
import 'package:qorix_markets_flutter/core/network/api_json.dart';
import 'package:qorix_markets_flutter/features/wallet/domain/entities/deposit_entity.dart';

class DepositAddressModel {
  const DepositAddressModel({required this.address, required this.network, required this.token});

  factory DepositAddressModel.fromJson(Map<String, dynamic> json) {
    final root = ApiJson.object(json);
    return DepositAddressModel(
      address: root['address'] as String? ?? '',
      network: root['network'] as String? ?? 'TRC20',
      token: root['token'] as String? ?? 'USDT',
    );
  }

  final String address;
  final String network;
  final String token;

  DepositAddressEntity toEntity() => DepositAddressEntity(address: address, network: network, token: token);
}

class BlockchainDepositModel {
  const BlockchainDepositModel({required this.id, required this.amount, required this.status, required this.createdAt});

  factory BlockchainDepositModel.fromJson(Map<String, dynamic> json) => BlockchainDepositModel(
        id: json['id']?.toString() ?? '',
        amount: ApiJson.asDouble(json['amount']),
        status: json['status'] as String? ?? 'pending',
        createdAt: DateTime.tryParse(json['createdAt'] as String? ?? '') ?? DateTime.now(),
      );

  final String id;
  final double amount;
  final String status;
  final DateTime createdAt;

  BlockchainDepositEntity toEntity() => BlockchainDepositEntity(id: id, amount: amount, status: status, createdAt: createdAt);
}

class BlockchainDepositHistoryModel {
  const BlockchainDepositHistoryModel({required this.deposits});

  factory BlockchainDepositHistoryModel.fromJson(Map<String, dynamic> json) {
    final list = ApiJson.list(json['deposits'] ?? json['items'] ?? json);
    return BlockchainDepositHistoryModel(
      deposits: list.map((e) => BlockchainDepositModel.fromJson(Map<String, dynamic>.from(e as Map))).toList(),
    );
  }

  final List<BlockchainDepositModel> deposits;
}
'''

FILES["data/models/inr_deposit_submit_result.dart"] = '''
import 'package:qorix_markets_flutter/core/network/api_json.dart';

class InrDepositSubmitResult {
  const InrDepositSubmitResult({required this.id, required this.status, this.message});

  factory InrDepositSubmitResult.fromJson(Map<String, dynamic> json) => InrDepositSubmitResult(
        id: (json['id'] as num?)?.toInt() ?? 0,
        status: json['status'] as String? ?? 'pending',
        message: json['message'] as String?,
      );

  final int id;
  final String status;
  final String? message;
}

class InrWithdrawSubmitResult {
  const InrWithdrawSubmitResult({required this.id, required this.status, required this.amount, this.message});

  factory InrWithdrawSubmitResult.fromJson(Map<String, dynamic> json) => InrWithdrawSubmitResult(
        id: (json['id'] as num?)?.toInt() ?? 0,
        status: json['status'] as String? ?? 'pending',
        amount: ApiJson.asDouble(json['amount']),
        message: json['message'] as String?,
      );

  final int id;
  final String status;
  final double amount;
  final String? message;
}
'''

FILES["data/models/inr_merchant_model.dart"] = '''
import 'package:qorix_markets_flutter/core/network/api_json.dart';

class InrMerchantModel {
  const InrMerchantModel({required this.id, required this.name, required this.method});

  factory InrMerchantModel.fromJson(Map<String, dynamic> json) => InrMerchantModel(
        id: json['id']?.toString() ?? '',
        name: json['name'] as String? ?? 'Merchant',
        method: json['method'] as String? ?? 'upi',
      );

  final String id;
  final String name;
  final String method;
}
'''

# ── Domain entities ────────────────────────────────────────────────────────────
FILES["features/wallet/domain/entities/wallet_entity.dart"] = '''
import 'package:equatable/equatable.dart';

class WalletEntity extends Equatable {
  const WalletEntity({
    required this.balance,
    required this.available,
    required this.currency,
    this.pending = 0,
    this.mainBalance = 0,
    this.tradingBalance = 0,
    this.profitBalance = 0,
  });

  final double balance;
  final double available;
  final String currency;
  final double pending;
  final double mainBalance;
  final double tradingBalance;
  final double profitBalance;

  @override
  List<Object?> get props => [balance, available, currency, pending, mainBalance, tradingBalance, profitBalance];
}

class TransactionEntity extends Equatable {
  const TransactionEntity({
    required this.id,
    required this.type,
    required this.amount,
    required this.currency,
    required this.status,
    required this.createdAt,
    this.description,
  });

  final String id;
  final String type;
  final double amount;
  final String currency;
  final String status;
  final DateTime createdAt;
  final String? description;

  @override
  List<Object?> get props => [id, type, amount, currency, status, createdAt, description];
}
'''

FILES["features/wallet/domain/entities/deposit_entity.dart"] = '''
import 'package:equatable/equatable.dart';

class DepositAddressEntity extends Equatable {
  const DepositAddressEntity({required this.address, required this.network, required this.token});
  final String address;
  final String network;
  final String token;
  @override
  List<Object?> get props => [address, network, token];
}

class BlockchainDepositEntity extends Equatable {
  const BlockchainDepositEntity({required this.id, required this.amount, required this.status, required this.createdAt});
  final String id;
  final double amount;
  final String status;
  final DateTime createdAt;
  @override
  List<Object?> get props => [id, amount, status, createdAt];
}
'''

FILES["features/kyc/domain/entities/kyc_state.dart"] = '''
import 'package:equatable/equatable.dart';

enum KycStatus { notStarted, pending, verified, rejected }

class KycState extends Equatable {
  const KycState({required this.status});
  final KycStatus status;
  @override
  List<Object?> get props => [status];
}
'''

FILES["features/portfolio/domain/entities/portfolio_summary.dart"] = '''
import 'package:equatable/equatable.dart';

class PortfolioSummary extends Equatable {
  const PortfolioSummary({
    required this.totalBalance,
    required this.dailyPnl,
    required this.dailyPnlPercent,
    required this.totalProfit,
    required this.activeInvestment,
    required this.isTrading,
  });

  final double totalBalance;
  final double dailyPnl;
  final double dailyPnlPercent;
  final double totalProfit;
  final double activeInvestment;
  final bool isTrading;

  @override
  List<Object?> get props => [totalBalance, dailyPnl, dailyPnlPercent, totalProfit, activeInvestment, isTrading];
}
'''

FILES["features/dashboard/domain/entities/dashboard_snapshot.dart"] = '''
import 'package:equatable/equatable.dart';

class VipInfo extends Equatable {
  const VipInfo({
    required this.tier,
    required this.label,
    required this.profitBonus,
    required this.withdrawalFee,
    required this.minAmount,
    this.nextTierLabel,
    this.nextTierMin,
    this.amountNeeded,
  });

  final String tier;
  final String label;
  final double profitBonus;
  final double withdrawalFee;
  final double minAmount;
  final String? nextTierLabel;
  final double? nextTierMin;
  final double? amountNeeded;

  @override
  List<Object?> get props => [tier, label, profitBonus, withdrawalFee, minAmount, nextTierLabel, nextTierMin, amountNeeded];
}

class FundStats extends Equatable {
  const FundStats({required this.aum, required this.activeInvestors, required this.winRate});
  final double aum;
  final int activeInvestors;
  final double winRate;
  @override
  List<Object?> get props => [aum, activeInvestors, winRate];
}

class EquityPoint extends Equatable {
  const EquityPoint({required this.date, required this.equity, required this.profit});
  final String date;
  final double equity;
  final double profit;
  @override
  List<Object?> get props => [date, equity, profit];
}

class DashboardSnapshot extends Equatable {
  const DashboardSnapshot({
    required this.totalBalance,
    required this.dailyPnl,
    required this.dailyPnlPercent,
    required this.totalProfit,
    required this.activeInvestment,
    required this.isTrading,
    required this.tradingBalance,
    required this.profitBalance,
    required this.mainBalance,
    required this.daysUntilPayout,
    required this.equityPoints,
    required this.monthlyReturn,
    required this.totalReturn,
    required this.vip,
    this.riskLevel,
    this.fundStats,
  });

  final double totalBalance;
  final double dailyPnl;
  final double dailyPnlPercent;
  final double totalProfit;
  final double activeInvestment;
  final bool isTrading;
  final double tradingBalance;
  final double profitBalance;
  final double mainBalance;
  final int daysUntilPayout;
  final List<EquityPoint> equityPoints;
  final double monthlyReturn;
  final double totalReturn;
  final VipInfo vip;
  final String? riskLevel;
  final FundStats? fundStats;

  @override
  List<Object?> get props => [
        totalBalance, dailyPnl, dailyPnlPercent, totalProfit, activeInvestment, isTrading,
        tradingBalance, profitBalance, mainBalance, daysUntilPayout, equityPoints,
        monthlyReturn, totalReturn, vip, riskLevel, fundStats,
      ];
}
'''

FILES["features/invest/domain/entities/risk_profile.dart"] = '''
import 'package:flutter/material.dart';

class RiskProfile {
  const RiskProfile({
    required this.id,
    required this.label,
    required this.tagline,
    required this.description,
    required this.monthlyRange,
    required this.drawdownLimit,
    required this.accentColor,
    required this.icon,
    this.recommended = false,
  });

  final String id;
  final String label;
  final String tagline;
  final String description;
  final String monthlyRange;
  final double drawdownLimit;
  final Color accentColor;
  final IconData icon;
  final bool recommended;
}

abstract final class RiskProfiles {
  static const all = [
    RiskProfile(
      id: 'LOW',
      label: 'Conservative',
      tagline: 'Capital preservation first',
      description: 'Lower volatility desk with tighter drawdown controls.',
      monthlyRange: '3–6%',
      drawdownLimit: 3,
      accentColor: Color(0xFF10B981),
      icon: Icons.shield_outlined,
    ),
    RiskProfile(
      id: 'MEDIUM',
      label: 'Balanced',
      tagline: 'Institutional default',
      description: 'Balanced growth with professional risk management.',
      monthlyRange: '6–12%',
      drawdownLimit: 5,
      accentColor: Color(0xFF8B5CF6),
      icon: Icons.auto_graph_rounded,
      recommended: true,
    ),
    RiskProfile(
      id: 'HIGH',
      label: 'Aggressive',
      tagline: 'Maximum desk velocity',
      description: 'Higher return potential with elevated drawdown tolerance.',
      monthlyRange: '12–20%',
      drawdownLimit: 10,
      accentColor: Color(0xFFF59E0B),
      icon: Icons.bolt_rounded,
    ),
  ];
}
'''

FILES["features/market/domain/entities/market_pair.dart"] = '''
import 'package:equatable/equatable.dart';

class MarketPair extends Equatable {
  const MarketPair({required this.symbol, required this.price, required this.changePercent});
  final String symbol;
  final double price;
  final double changePercent;
  @override
  List<Object?> get props => [symbol, price, changePercent];
}
'''

FILES["features/market/domain/entities/candle.dart"] = '''
import 'package:equatable/equatable.dart';

class Candle extends Equatable {
  const Candle({required this.open, required this.high, required this.low, required this.close, required this.time});
  final double open;
  final double high;
  final double low;
  final double close;
  final DateTime time;
  @override
  List<Object?> get props => [open, high, low, close, time];
}
'''

FILES["features/activity/domain/entities/live_activity_event.dart"] = '''
import 'package:equatable/equatable.dart';

enum LiveActivityKind { profit, capital, deployment, platform }

class LiveActivityEvent extends Equatable {
  const LiveActivityEvent({
    required this.id,
    required this.kind,
    required this.headline,
    required this.detail,
    required this.occurredAt,
    this.amount,
  });

  final String id;
  final LiveActivityKind kind;
  final String headline;
  final String detail;
  final DateTime occurredAt;
  final double? amount;

  @override
  List<Object?> get props => [id, kind, headline, detail, occurredAt, amount];
}
'''

FILES["features/notifications/domain/entities/notification_entity.dart"] = '''
import 'package:equatable/equatable.dart';

class NotificationEntity extends Equatable {
  const NotificationEntity({
    required this.id,
    required this.type,
    required this.title,
    required this.message,
    required this.isRead,
    required this.createdAt,
  });

  final String id;
  final String type;
  final String title;
  final String message;
  final bool isRead;
  final DateTime createdAt;

  @override
  List<Object?> get props => [id, type, title, message, isRead, createdAt];
}
'''

FILES["features/referral/domain/entities/referral_info.dart"] = '''
import 'package:equatable/equatable.dart';

class ReferralInfo extends Equatable {
  const ReferralInfo({
    required this.referralCode,
    required this.totalReferred,
    required this.activeReferrals,
    required this.totalEarned,
    required this.monthlyEarnings,
  });

  final String referralCode;
  final int totalReferred;
  final int activeReferrals;
  final double totalEarned;
  final double monthlyEarnings;

  @override
  List<Object?> get props => [referralCode, totalReferred, activeReferrals, totalEarned, monthlyEarnings];
}

class ReferredUser extends Equatable {
  const ReferredUser({
    required this.id,
    required this.fullName,
    required this.email,
    required this.investmentAmount,
    required this.isActive,
    required this.joinedAt,
  });

  final int id;
  final String fullName;
  final String email;
  final double investmentAmount;
  final bool isActive;
  final DateTime joinedAt;

  @override
  List<Object?> get props => [id, fullName, email, investmentAmount, isActive, joinedAt];
}
'''

SCREEN_STUB = '''
import 'package:flutter/material.dart';

class {class_name} extends StatelessWidget {{
  const {class_name}({{super.key}});

  @override
  Widget build(BuildContext context) {{
    return const Scaffold(
      body: Center(child: Text('{class_name}')),
    );
  }}
}}
'''

for cls in [
    "LoginApprovalScreen", "LoginTwoFactorScreen", "ResetPasswordConfirmScreen",
    "EarnScreen", "AiActivityScreen", "StrategyDetailScreen", "OnboardingScreen", "VipScreen", "SupportChatScreen",
]:
    path = {
        "LoginApprovalScreen": "features/auth/presentation/screens/login_approval_screen.dart",
        "LoginTwoFactorScreen": "features/auth/presentation/screens/login_two_factor_screen.dart",
        "ResetPasswordConfirmScreen": "features/auth/presentation/screens/reset_password_confirm_screen.dart",
        "EarnScreen": "features/earn/presentation/screens/earn_screen.dart",
        "AiActivityScreen": "features/invest/presentation/screens/ai_activity_screen.dart",
        "StrategyDetailScreen": "features/invest/presentation/screens/strategy_detail_screen.dart",
        "OnboardingScreen": "features/onboarding/presentation/screens/onboarding_screen.dart",
        "VipScreen": "features/vip/presentation/screens/vip_screen.dart",
        "SupportChatScreen": "features/support/presentation/screens/support_chat_screen.dart",
    }[cls]
    FILES[path] = SCREEN_STUB.format(class_name=cls)

FILES["features/auth/dev/dev_auth.dart"] = '''
abstract final class DevAuth {
  static const storageKey = 'dev_auth_bypass';
  static bool isActive = false;
  static bool bypassEnabled = false;
}
'''

FILES["features/wallet/presentation/data/withdraw_inr_options.dart"] = '''
abstract final class WithdrawInrOptions {
  static const methods = ['bank', 'upi'];
}
'''

FILES["features/wallet/presentation/data/transfer_balances.dart"] = '''
abstract final class TransferBalances {
  static double main = 0;
  static double trading = 0;
}
'''

FILES["features/home/presentation/data/bot_presets.dart"] = '''
abstract final class BotPresets {
  static const presets = <Map<String, String>>[];
}
'''

FILES["features/dashboard/domain/repositories/dashboard_repository.dart"] = '''
import 'package:qorix_markets_flutter/features/dashboard/domain/entities/dashboard_snapshot.dart';

abstract interface class DashboardRepository {
  Future<DashboardSnapshot> getSnapshot();
}
'''

FILES["features/dashboard/infrastructure/dashboard_repository_impl.dart"] = '''
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:qorix_markets_flutter/core/network/api_client.dart';
import 'package:qorix_markets_flutter/data/models/dashboard_summary_model.dart';
import 'package:qorix_markets_flutter/features/dashboard/domain/entities/dashboard_snapshot.dart';
import 'package:qorix_markets_flutter/features/dashboard/domain/repositories/dashboard_repository.dart';
import 'package:qorix_markets_flutter/services/api/dashboard_api_service.dart';

final dashboardRepositoryProvider = Provider<DashboardRepository>((ref) {
  return DashboardRepositoryImpl(ref.watch(dashboardApiServiceProvider));
});

class DashboardRepositoryImpl implements DashboardRepository {
  DashboardRepositoryImpl(this._api);
  final DashboardApiService _api;

  @override
  Future<DashboardSnapshot> getSnapshot() async {
    try {
      final model = await _api.getSummary();
      return model.toSnapshot();
    } on DioException catch (e) {
      throw mapDioExceptionToException(e);
    }
  }
}
'''

# Extend dashboard_summary_model with toSnapshot - patch via separate small file? 
# Actually dashboard model may not have toSnapshot - check

FILES["features/wallet/application/deposit_flow_provider.dart"] = '''
import 'package:flutter_riverpod/flutter_riverpod.dart';

class DepositFlowNotifier extends Notifier<void> {
  @override
  void build() {}

  void onDepositConfirmed({double? amount}) {}
}

final depositFlowProvider = NotifierProvider<DepositFlowNotifier, void>(DepositFlowNotifier.new);
'''

FILES["features/wallet/application/transfer_flow_provider.dart"] = '''
import 'package:flutter_riverpod/flutter_riverpod.dart';

final transferFlowProvider = StateProvider<double>((ref) => 0);
'''

FILES["features/referral/application/referral_providers.dart"] = '''
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:qorix_markets_flutter/features/referral/domain/entities/referral_info.dart';
import 'package:qorix_markets_flutter/ui/mock/ui_demo_fixtures.dart';
import 'package:qorix_markets_flutter/core/config/ui_demo_mode.dart';

final referralProvider = Provider<ReferralInfo>((ref) {
  if (UiDemoMode.isActive) return UiDemoFixtures.referral();
  return const ReferralInfo(referralCode: '', totalReferred: 0, activeReferrals: 0, totalEarned: 0, monthlyEarnings: 0);
});
'''

FILES["features/activity/application/live_activity_providers.dart"] = '''
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:qorix_markets_flutter/core/config/ui_demo_mode.dart';
import 'package:qorix_markets_flutter/features/activity/domain/entities/live_activity_event.dart';
import 'package:qorix_markets_flutter/ui/mock/ui_demo_fixtures.dart';

class LiveActivityNotifier extends Notifier<List<LiveActivityEvent>> {
  @override
  List<LiveActivityEvent> build() {
    if (UiDemoMode.isActive) return UiDemoFixtures.liveActivityEvents();
    return const [];
  }

  Future<void> refresh() async {
    if (UiDemoMode.isActive) state = UiDemoFixtures.liveActivityEvents();
  }

  void ingestWsEvent(String type, Map<String, dynamic> payload) {}
}

final liveActivityProvider = NotifierProvider<LiveActivityNotifier, List<LiveActivityEvent>>(LiveActivityNotifier.new);
'''

FILES["features/onboarding/presentation/providers/onboarding_provider.dart"] = '''
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

final onboardingCompleteProvider = FutureProvider<bool>((ref) async {
  const storage = FlutterSecureStorage();
  final v = await storage.read(key: 'onboarding_complete');
  return v == '1';
});

Future<void> setOnboardingComplete() async {
  const storage = FlutterSecureStorage();
  await storage.write(key: 'onboarding_complete', value: '1');
}
'''

FILES["features/profile/application/security_providers.dart"] = '''
import 'package:flutter_riverpod/flutter_riverpod.dart';

final twoFactorEnabledProvider = Provider<bool>((ref) => false);
'''

FILES["features/support/application/help_support_provider.dart"] = '''
import 'package:flutter_riverpod/flutter_riverpod.dart';

final helpSupportProvider = Provider<String>((ref) => 'support@qorixmarkets.com');
'''

FILES["features/notifications/infrastructure/notification_repository_impl.dart"] = '''
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:qorix_markets_flutter/features/notifications/domain/entities/notification_entity.dart';
import 'package:qorix_markets_flutter/features/notifications/domain/repositories/notification_repository.dart';

final notificationRepositoryProvider = Provider<NotificationRepository>((ref) => NotificationRepositoryImpl());

class NotificationRepositoryImpl implements NotificationRepository {
  @override
  Future<List<NotificationEntity>> fetch() async => const [];
}
'''

FILES["features/market/presentation/widgets/p2p_order_chat_sheet.dart"] = '''
import 'package:flutter/material.dart';

Future<void> showP2pOrderChatSheet(BuildContext context) async {}
'''

FILES["features/invest/presentation/widgets/investment_action_sheets.dart"] = '''
import 'package:flutter/material.dart';

Future<void> showInvestmentActionSheet(BuildContext context) async {}
'''

WIDGET_STUB = '''
import 'package:flutter/material.dart';

class {class_name} extends StatelessWidget {{
  const {class_name}({{super.key, this.child}});
  final Widget? child;

  @override
  Widget build(BuildContext context) => child ?? const SizedBox.shrink();
}}
'''

for cls, path in [
    ("PrimaryButton", "widgets/primary_button.dart"),
    ("GlassCard", "widgets/glass_card.dart"),
    ("SectionHeader", "widgets/section_header.dart"),
    ("OfflineRecoveryBanner", "ui/components/offline_recovery_banner.dart"),
    ("AiConfidenceMeter", "ui/components/ai_confidence_meter.dart"),
    ("CapitalAllocationVisualizer", "ui/components/capital_allocation_visualizer.dart"),
    ("DeskAllocationFeed", "ui/components/desk_allocation_feed.dart"),
    ("ProjectedGrowthChart", "ui/components/projected_growth_chart.dart"),
    ("RiskShieldVisual", "ui/components/risk_shield_visual.dart"),
    ("InstitutionalTrustBar", "ui/components/institutional_trust_bar.dart"),
    ("FloatingGlowOrbs", "ui/components/floating_glow_orbs.dart"),
    ("PremiumLoadingPulse", "ui/components/premium_loading_pulse.dart"),
    ("QorixLogo", "ui/components/qorix_logo.dart"),
    ("AiDeskFeed", "ui/components/ai_desk_feed.dart"),
]:
    if cls == "PrimaryButton":
        FILES[path] = '''
import 'package:flutter/material.dart';
import 'package:qorix_markets_flutter/core/theme/app_colors.dart';

class PrimaryButton extends StatelessWidget {
  const PrimaryButton({required this.label, this.onPressed, this.expand = true, super.key});
  final String label;
  final VoidCallback? onPressed;
  final bool expand;

  @override
  Widget build(BuildContext context) {
    final btn = FilledButton(
      onPressed: onPressed,
      style: FilledButton.styleFrom(backgroundColor: AppColors.brand, minimumSize: const Size(0, 52)),
      child: Text(label),
    );
    return expand ? SizedBox(width: double.infinity, child: btn) : btn;
  }
}
'''
    elif cls == "QorixLogo":
        FILES[path] = '''
import 'package:flutter/material.dart';
import 'package:qorix_markets_flutter/core/theme/app_colors.dart';

class QorixLogo extends StatelessWidget {
  const QorixLogo({this.size = 48, super.key});
  final double size;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        gradient: AppColors.brandGradient,
        borderRadius: BorderRadius.circular(size * 0.28),
      ),
      child: Text('Q', style: TextStyle(color: Colors.white, fontSize: size * 0.45, fontWeight: FontWeight.w800)),
    );
  }
}
'''
    elif cls == "OfflineRecoveryBanner":
        FILES[path] = '''
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:qorix_markets_flutter/core/connectivity/connectivity_service.dart';

class OfflineRecoveryBanner extends ConsumerWidget {
  const OfflineRecoveryBanner({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final online = ref.watch(isOnlineProvider).value ?? true;
    if (online) return const SizedBox.shrink();
    return const Positioned(
      top: 0,
      left: 0,
      right: 0,
      child: Material(
        color: Color(0xFFB45309),
        child: Padding(
          padding: EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          child: Text('You are offline — reconnecting…', style: TextStyle(color: Colors.white, fontSize: 12)),
        ),
      ),
    );
  }
}
'''
    elif cls == "AiDeskFeed":
        FILES[path] = '''
import 'package:flutter/material.dart';

class AiDeskEvent {
  const AiDeskEvent({required this.label, required this.detail, required this.impactPercent, required this.timeAgo});
  final String label;
  final String detail;
  final double impactPercent;
  final String timeAgo;
}

class AiDeskFeed extends StatelessWidget {
  const AiDeskFeed({required this.events, super.key});
  final List<AiDeskEvent> events;

  @override
  Widget build(BuildContext context) {
    if (events.isEmpty) return const SizedBox.shrink();
    return Column(
      children: events.map((e) => ListTile(title: Text(e.label), subtitle: Text('${e.detail} · ${e.timeAgo}'))).toList(),
    );
  }
}
'''
    elif cls == "DeskAllocationFeed":
        FILES["ui/components/desk_allocation_feed.dart"] = '''
import 'package:flutter/material.dart';

class DeskAllocationEvent {
  const DeskAllocationEvent({required this.asset, required this.action, required this.allocationPercent, required this.timeAgo});
  final String asset;
  final String action;
  final double allocationPercent;
  final String timeAgo;
}

class AllocationSlice {
  const AllocationSlice({required this.label, required this.percent, required this.color});
  final String label;
  final double percent;
  final Color color;
}

class DeskAllocationFeed extends StatelessWidget {
  const DeskAllocationFeed({required this.events, super.key});
  final List<DeskAllocationEvent> events;

  @override
  Widget build(BuildContext context) => events.isEmpty ? const SizedBox.shrink() : const SizedBox(height: 8);
}
'''
        continue
    else:
        FILES[path] = WIDGET_STUB.format(class_name=cls)

# Fix capital visualizer - write separately
FILES["ui/components/capital_allocation_visualizer.dart"] = '''
import 'package:flutter/material.dart';
import 'package:qorix_markets_flutter/ui/components/desk_allocation_feed.dart';

class CapitalAllocationVisualizer extends StatelessWidget {
  const CapitalAllocationVisualizer({required this.slices, super.key});
  final List<AllocationSlice> slices;

  @override
  Widget build(BuildContext context) => const SizedBox(height: 120);
}
'''

FILES["ui/mock/ui_mock_data.dart"] = '''
class UiMockData {
  static const totalBalance = 12847.0;
  static const dailyPnl = 102.78;
  static const dailyPnlPercent = 0.8;
  static const totalProfit = 380.5;
  static const activeStrategyDeployed = 5000.0;
  static const isTrading = true;
  static const capitalFlowMain = 7847.0;
  static const capitalFlowTrading = 3200.0;
  static const capitalFlowProfit = 1800.0;
  static const daysUntilPayout = 3;
  static const drawdownPercent = 1.2;
  static const drawdownLimit = 5.0;
  static const isProtectionTriggered = false;
  static const monthlyReturn = 8.4;
  static const totalReturn = 24.5;
  static const fundAum = 12.8;
  static const investorsOnline = 842;
  static const depositAddress = 'TXYZqorixDemoAddress123';
  static const referralCode = 'QORIX2026';
  static const totalReferred = 12;
  static const activeReferrals = 8;
  static const referralTotalEarned = 420.0;
  static const referralMonthly = 86.0;
  static const unreadNotifications = 3;
  static const vipTier = 'gold';
  static const vipLabel = 'Gold';
  static const vipProfitBonus = 0.15;
  static const vipWithdrawalFee = 0.5;
  static const vipMinAmount = 5000.0;
  static const vipNextTierLabel = 'Platinum';
  static const vipNextTierMin = 25000.0;
  static const vipAmountNeeded = 12153.0;
  static const equityPoints = <({String date, double equity, double profit})>[];
  static const projectedGrowth = <double>[];
  static const profitHistory = <double>[];
  static const liveActivities = <({String name, String city, String action, int minutesAgo, double? amount})>[
    (name: 'Alex', city: 'Mumbai', action: 'profit credited', minutesAgo: 2, amount: 42.0),
  ];
}

class UiMockNotifications {
  static final list = [
    _MockNotification(id: '1', type: 'profit', title: 'Daily profit', message: '+\$102.78 credited', isRead: false, createdAt: DateTime.now()),
  ];
}

class _MockNotification {
  const _MockNotification({required this.id, required this.type, required this.title, required this.message, required this.isRead, required this.createdAt});
  final String id;
  final String type;
  final String title;
  final String message;
  final bool isRead;
  final DateTime createdAt;
}
'''

if __name__ == "__main__":
    print("Writing", len(FILES), "files...")
    for rel, content in sorted(FILES.items()):
        w(rel, content)
    print("Done.")
