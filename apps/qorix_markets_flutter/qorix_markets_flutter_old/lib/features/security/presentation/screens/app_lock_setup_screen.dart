import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:qorix_markets_flutter/core/security/app_lock_provider.dart';
import 'package:qorix_markets_flutter/core/theme/app_colors.dart';
import 'package:qorix_markets_flutter/core/utils/app_nav.dart';
import 'package:qorix_markets_flutter/features/security/presentation/widgets/app_lock_ui.dart';

enum _SetupStep { enter, confirm, current, newPin, confirmNew }

class AppLockSetupScreen extends ConsumerStatefulWidget {
  const AppLockSetupScreen({super.key});

  @override
  ConsumerState<AppLockSetupScreen> createState() => _AppLockSetupScreenState();
}

class _AppLockSetupScreenState extends ConsumerState<AppLockSetupScreen> {
  _SetupStep _step = _SetupStep.enter;
  String _pin = '';
  String _firstPin = '';
  String _currentPin = '';
  bool _biometric = true;
  bool _busy = false;

  bool _manageModeChecked = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _initManageMode());
  }

  void _initManageMode() {
    if (_manageModeChecked || !mounted) return;
    _manageModeChecked = true;
    if (ref.read(appLockProvider).isActive) {
      setState(() => _step = _SetupStep.current);
    }
  }

  String get _title => switch (_step) {
        _SetupStep.enter => 'Create app PIN',
        _SetupStep.confirm => 'Confirm PIN',
        _SetupStep.current => 'Enter current PIN',
        _SetupStep.newPin => 'New PIN',
        _SetupStep.confirmNew => 'Confirm new PIN',
      };

  String get _subtitle => switch (_step) {
        _SetupStep.enter => '6-digit PIN protects your portfolio when app is reopened',
        _SetupStep.confirm => 'Re-enter PIN to confirm',
        _SetupStep.current => 'Verify identity to manage app lock',
        _SetupStep.newPin => 'Choose a new 6-digit PIN',
        _SetupStep.confirmNew => 'Re-enter new PIN',
      };

  void _addDigit(String d) {
    if (_pin.length >= 6 || _busy) return;
    setState(() => _pin += d);
    if (_pin.length == 6) _onFilled();
  }

  void _backspace() {
    if (_pin.isEmpty || _busy) return;
    setState(() => _pin = _pin.substring(0, _pin.length - 1));
  }

  Future<void> _onFilled() async {
    setState(() => _busy = true);
    try {
      switch (_step) {
        case _SetupStep.enter:
          _firstPin = _pin;
          setState(() {
            _pin = '';
            _step = _SetupStep.confirm;
            _busy = false;
          });
        case _SetupStep.confirm:
          await ref.read(appLockProvider.notifier).enableLock(
                pin: _firstPin,
                confirmPin: _pin,
                biometric: _biometric && ref.read(appLockProvider).biometricAvailable,
              );
          if (!mounted) return;
          _showSnack('App lock enabled');
          context.pop();
        case _SetupStep.current:
          _currentPin = _pin;
          setState(() {
            _pin = '';
            _step = _SetupStep.newPin;
            _busy = false;
          });
        case _SetupStep.newPin:
          _firstPin = _pin;
          setState(() {
            _pin = '';
            _step = _SetupStep.confirmNew;
            _busy = false;
          });
        case _SetupStep.confirmNew:
          await ref.read(appLockProvider.notifier).changePin(
                currentPin: _currentPin,
                newPin: _firstPin,
                confirmPin: _pin,
              );
          if (!mounted) return;
          _showSnack('PIN updated');
          context.pop();
      }
    } on AppLockException catch (e) {
      if (!mounted) return;
      _showSnack(e.message);
      setState(() {
        _pin = '';
        _busy = false;
        if (_step == _SetupStep.confirm || _step == _SetupStep.confirmNew) {
          _step = _step == _SetupStep.confirm ? _SetupStep.enter : _SetupStep.newPin;
          _firstPin = '';
        }
      });
    } catch (_) {
      if (!mounted) return;
      _showSnack('Something went wrong');
      setState(() {
        _pin = '';
        _busy = false;
      });
    }
  }

  Future<void> _disableLock() async {
    if (_pin.length != 6) {
      _showSnack('Enter current PIN to disable');
      return;
    }
    setState(() => _busy = true);
    try {
      await ref.read(appLockProvider.notifier).disableLock(_pin);
      if (!mounted) return;
      _showSnack('App lock disabled');
      context.pop();
    } on AppLockException catch (e) {
      _showSnack(e.message);
      setState(() {
        _pin = '';
        _busy = false;
      });
    }
  }

  Future<void> _toggleBiometric(bool v) async {
    setState(() => _busy = true);
    try {
      await ref.read(appLockProvider.notifier).setBiometricEnabled(v);
      if (!mounted) return;
      setState(() {
        _biometric = v;
        _busy = false;
      });
      _showSnack(v ? 'Biometric unlock enabled' : 'Biometric unlock disabled');
    } on AppLockException catch (e) {
      _showSnack(e.message);
      setState(() => _busy = false);
    }
  }

  void _showSnack(String msg) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(msg), behavior: SnackBarBehavior.floating),
    );
  }

  @override
  Widget build(BuildContext context) {
    final lock = ref.watch(appLockProvider);
    final isManageMode = lock.isActive;

    return Scaffold(
      backgroundColor: const Color(0xFF0A0E12),
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        leading: IconButton(
          onPressed: () => safePop(context),
          icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 18, color: Colors.white),
        ),
        title: const Text('App lock', style: TextStyle(fontWeight: FontWeight.w800)),
        centerTitle: true,
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24),
          child: Column(
            children: [
              const SizedBox(height: 12),
              Text(_title, style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: Colors.white)),
              const SizedBox(height: 8),
              Text(_subtitle, textAlign: TextAlign.center, style: TextStyle(fontSize: 12, height: 1.4, color: AppColors.authMuted.withValues(alpha: 0.8))),
              const SizedBox(height: 28),
              AppLockPinField(length: _pin.length, label: 'PIN'),
              const SizedBox(height: 24),
              if (_step == _SetupStep.enter && lock.biometricAvailable) ...[
                SwitchListTile(
                  contentPadding: EdgeInsets.zero,
                  title: Text(lock.biometricLabel, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: Colors.white)),
                  subtitle: Text('Unlock with biometrics when app reopens', style: TextStyle(fontSize: 11, color: AppColors.authMuted.withValues(alpha: 0.7))),
                  value: _biometric,
                  onChanged: _busy ? null : (v) => setState(() => _biometric = v),
                  activeTrackColor: AppColors.authGreen.withValues(alpha: 0.45),
                  activeThumbColor: AppColors.authGreen,
                ),
                const SizedBox(height: 8),
              ],
              if (isManageMode && _step == _SetupStep.current) ...[
                SwitchListTile(
                  contentPadding: EdgeInsets.zero,
                  title: const Text('Biometric unlock', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: Colors.white)),
                  subtitle: Text(lock.biometricLabel, style: TextStyle(fontSize: 11, color: AppColors.authMuted.withValues(alpha: 0.7))),
                  value: lock.biometricEnabled,
                  onChanged: lock.biometricAvailable && !_busy ? _toggleBiometric : null,
                  activeTrackColor: AppColors.authGreen.withValues(alpha: 0.45),
                  activeThumbColor: AppColors.authGreen,
                ),
                const SizedBox(height: 8),
              ],
              const Spacer(),
              AppLockSetupKeypad(onDigit: _addDigit, onBackspace: _backspace),
              const SizedBox(height: 16),
              if (isManageMode && _step == _SetupStep.current)
                TextButton(
                  onPressed: _busy ? null : _disableLock,
                  child: Text('Disable app lock', style: TextStyle(color: AppColors.sell.withValues(alpha: 0.9), fontWeight: FontWeight.w700)),
                ),
              const SizedBox(height: 12),
            ],
          ),
        ),
      ),
    );
  }
}
