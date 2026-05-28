import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:qorix_markets_flutter/core/theme/app_colors.dart';
import 'package:qorix_markets_flutter/core/utils/app_nav.dart';
import 'package:qorix_markets_flutter/core/utils/error_message.dart';
import 'package:qorix_markets_flutter/core/utils/responsive.dart';
import 'package:qorix_markets_flutter/data/models/kyc_status_model.dart';
import 'package:qorix_markets_flutter/features/kyc/core/kyc_image_helper.dart';
import 'package:qorix_markets_flutter/features/kyc/data/repositories/kyc_repository_impl.dart';
import 'package:qorix_markets_flutter/features/kyc/presentation/providers/kyc_providers.dart';
import 'package:qorix_markets_flutter/features/kyc/presentation/widgets/kyc_ui.dart';

String normalizeIndianPhone(String input) {
  final digits = input.replaceAll(RegExp(r'\D'), '');
  if (digits.length == 10) return digits;
  if (digits.length == 12 && digits.startsWith('91')) return digits.substring(2);
  return digits;
}

/// Lv1 phone OTP → DOB → Lv2 docs → Lv3 address (live API).
class KycVerificationFlowScreen extends ConsumerStatefulWidget {
  const KycVerificationFlowScreen({super.key, this.initialStep});

  final int? initialStep;

  @override
  ConsumerState<KycVerificationFlowScreen> createState() => _KycVerificationFlowScreenState();
}

class _KycVerificationFlowScreenState extends ConsumerState<KycVerificationFlowScreen> {
  late int _step;
  final _phone = TextEditingController();
  final _otp = TextEditingController();
  final _dob = TextEditingController();
  final _line1 = TextEditingController();
  final _city = TextEditingController();
  final _stateField = TextEditingController();
  final _country = TextEditingController(text: 'India');
  final _postal = TextEditingController();

  String _otpChannel = 'sms';
  String _docType = 'national_id';
  String? _frontUrl;
  String? _backUrl;
  String? _proofUrl;
  String? _error;

  @override
  void initState() {
    super.initState();
    _step = widget.initialStep ?? 0;
  }

  @override
  void dispose() {
    for (final c in [_phone, _otp, _dob, _line1, _city, _stateField, _country, _postal]) {
      c.dispose();
    }
    super.dispose();
  }

  bool get _loading => ref.watch(kycActionProvider).isLoading;

  Future<void> _run(Future<void> Function() action) async {
    setState(() => _error = null);
    try {
      await action();
      if (!mounted) return;
      final status = await ref.read(kycRepositoryProvider).getStatus();
      refreshKycStatus(ref);
      final next = status.nextStepIndex();
      if (next == null) {
        safePop(context);
        return;
      }
      setState(() => _step = next);
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = ErrorMessage.from(e));
    }
  }

  @override
  Widget build(BuildContext context) {
    final statusAsync = ref.watch(kycLiveStatusProvider);

    return Scaffold(
      backgroundColor: const Color(0xFF0A0E12),
      body: SafeArea(
        child: Responsive.constrained(
          context,
          statusAsync.when(
            loading: () => const Center(child: CircularProgressIndicator(color: AppColors.authGreen)),
            error: (e, _) => _errorBody(ErrorMessage.from(e)),
            data: (status) {
              if (_step == 0 && status.nextStepIndex() != null && status.nextStepIndex()! > 0) {
                WidgetsBinding.instance.addPostFrameCallback((_) {
                  if (mounted) setState(() => _step = status.nextStepIndex()!);
                });
              }
              return ListView(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
                children: [
                  KycAppBar(onBack: () => safePop(context)),
                  const SizedBox(height: 12),
                  Text(
                    'Step ${_step + 1} of 3',
                    style: TextStyle(color: Colors.white.withValues(alpha: 0.5), fontSize: 12, fontWeight: FontWeight.w600),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    switch (_step) {
                      0 => 'Mobile & personal details',
                      1 => 'Identity document',
                      _ => 'Address verification',
                    },
                    style: const TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.w800),
                  ),
                  const SizedBox(height: 20),
                  if (_error != null) ...[
                    Text(_error!, style: const TextStyle(color: Color(0xFFFF6B8A), fontSize: 13)),
                    const SizedBox(height: 12),
                  ],
                  if (_step == 0) _buildLv1(status),
                  if (_step == 1) _buildLv2(status),
                  if (_step == 2) _buildLv3(status),
                ],
              );
            },
          ),
        ),
      ),
    );
  }

  Widget _errorBody(String message) => ListView(
        padding: const EdgeInsets.all(24),
        children: [
          KycAppBar(onBack: () => safePop(context)),
          const SizedBox(height: 24),
          Text(message, style: const TextStyle(color: Colors.white70)),
        ],
      );

  Widget _field(TextEditingController c, String hint, {TextInputType? keyboard}) {
    return TextField(
      controller: c,
      keyboardType: keyboard,
      style: const TextStyle(color: Colors.white),
      decoration: InputDecoration(
        hintText: hint,
        hintStyle: TextStyle(color: Colors.white.withValues(alpha: 0.35)),
        filled: true,
        fillColor: const Color(0xFF12171C),
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Color(0xFF1E2630))),
      ),
    );
  }

  Widget _buildLv1(KycStatusModel status) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (!status.phoneVerified) ...[
          _field(_phone, '10-digit mobile number', keyboard: TextInputType.phone),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            children: [
              _channelChip('sms', 'SMS'),
              _channelChip('call', 'Voice call'),
            ],
          ),
          const SizedBox(height: 12),
          _actionButton(
            'Send OTP',
            _loading ? null : () => _run(() => ref.read(kycActionProvider.notifier).sendPhoneOtp(
                  phone: normalizeIndianPhone(_phone.text),
                  channel: _otpChannel,
                )),
          ),
          const SizedBox(height: 12),
          _field(_otp, 'OTP code', keyboard: TextInputType.number),
          const SizedBox(height: 12),
          _actionButton(
            'Verify mobile',
            _loading ? null : () => _run(() => ref.read(kycActionProvider.notifier).verifyPhoneOtp(
                  phone: normalizeIndianPhone(_phone.text),
                  otp: _otp.text.trim(),
                )),
          ),
        ] else
          Text('Mobile verified · ${status.phoneNumber ?? ''}', style: const TextStyle(color: Colors.white70)),
        const SizedBox(height: 20),
        _field(_dob, 'Date of birth (YYYY-MM-DD)'),
        const SizedBox(height: 12),
        _actionButton(
          'Submit personal details',
          _loading || !status.phoneVerified
              ? null
              : () => _run(() => ref.read(kycActionProvider.notifier).submitPersonal(_dob.text.trim())),
        ),
      ],
    );
  }

  Widget _channelChip(String value, String label) {
    final selected = _otpChannel == value;
    return ChoiceChip(
      label: Text(label),
      selected: selected,
      onSelected: _loading
          ? null
          : (_) => setState(() => _otpChannel = value),
      selectedColor: AppColors.authGreen.withValues(alpha: 0.25),
    );
  }

  Widget _buildLv2(KycStatusModel status) {
    final needsBack = _docType == 'national_id' || _docType == 'drivers_license';
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        DropdownButtonFormField<String>(
          value: _docType,
          dropdownColor: const Color(0xFF12171C),
          style: const TextStyle(color: Colors.white),
          decoration: const InputDecoration(labelText: 'Document type', labelStyle: TextStyle(color: Colors.white54)),
          items: const [
            DropdownMenuItem(value: 'national_id', child: Text('National ID / Aadhaar')),
            DropdownMenuItem(value: 'passport', child: Text('Passport')),
            DropdownMenuItem(value: 'drivers_license', child: Text("Driver's license")),
          ],
          onChanged: _loading ? null : (v) => setState(() => _docType = v ?? 'national_id'),
        ),
        const SizedBox(height: 12),
        _pickRow('Front side', _frontUrl, () async {
          final url = await KycImageHelper.pickDataUrl();
          if (url != null) setState(() => _frontUrl = url);
        }),
        if (needsBack) ...[
          const SizedBox(height: 8),
          _pickRow('Back side', _backUrl, () async {
            final url = await KycImageHelper.pickDataUrl();
            if (url != null) setState(() => _backUrl = url);
          }),
        ],
        const SizedBox(height: 16),
        _actionButton(
          'Submit identity',
          _loading || _frontUrl == null || (needsBack && _backUrl == null)
              ? null
              : () => _run(() => ref.read(kycActionProvider.notifier).submitIdentity(
                    documentType: _docType,
                    front: _frontUrl!,
                    back: _backUrl,
                  )),
        ),
        if (status.kycStatus == 'pending')
          const Padding(
            padding: EdgeInsets.only(top: 12),
            child: Text('Identity under review — you can continue to address after approval.', style: TextStyle(color: Colors.white54, fontSize: 12)),
          ),
      ],
    );
  }

  Widget _buildLv3(KycStatusModel status) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _field(_line1, 'Address line'),
        const SizedBox(height: 8),
        _field(_city, 'City'),
        const SizedBox(height: 8),
        _field(_stateField, 'State'),
        const SizedBox(height: 8),
        _field(_country, 'Country'),
        const SizedBox(height: 8),
        _field(_postal, 'Postal code'),
        const SizedBox(height: 12),
        _pickRow('Proof of address', _proofUrl, () async {
          final url = await KycImageHelper.pickDataUrl();
          if (url != null) setState(() => _proofUrl = url);
        }),
        const SizedBox(height: 16),
        _actionButton(
          'Submit address',
          _loading || _proofUrl == null
              ? null
              : () => _run(() => ref.read(kycActionProvider.notifier).submitAddress(
                    line1: _line1.text.trim(),
                    city: _city.text.trim(),
                    state: _stateField.text.trim(),
                    country: _country.text.trim(),
                    postal: _postal.text.trim(),
                    proofUrl: _proofUrl!,
                  )),
        ),
        if (status.kycAddressStatus == 'pending')
          const Padding(
            padding: EdgeInsets.only(top: 12),
            child: Text('Address proof submitted — under review.', style: TextStyle(color: Colors.white54, fontSize: 12)),
          ),
      ],
    );
  }

  Widget _pickRow(String label, String? picked, VoidCallback onPick) {
    return OutlinedButton.icon(
      onPressed: _loading ? null : onPick,
      icon: const Icon(Icons.upload_file_rounded),
      label: Text(picked == null ? 'Upload $label' : '$label selected'),
      style: OutlinedButton.styleFrom(foregroundColor: Colors.white, side: const BorderSide(color: Color(0xFF1E2630))),
    );
  }

  Widget _actionButton(String label, VoidCallback? onTap) {
    return FilledButton(
      onPressed: onTap == null
          ? null
          : () {
              HapticFeedback.mediumImpact();
              onTap();
            },
      style: FilledButton.styleFrom(
        backgroundColor: AppColors.authGreen,
        foregroundColor: const Color(0xFF0A0E12),
        minimumSize: const Size.fromHeight(48),
      ),
      child: _loading
          ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2))
          : Text(label, style: const TextStyle(fontWeight: FontWeight.w800)),
    );
  }
}
