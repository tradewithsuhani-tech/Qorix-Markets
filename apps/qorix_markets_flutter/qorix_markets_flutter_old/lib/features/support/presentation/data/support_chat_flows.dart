class SupportChatOption {
  const SupportChatOption({required this.label, required this.value});

  final String label;
  final String value;
}

class SupportChatFlow {
  const SupportChatFlow({required this.message, this.options = const []});

  final String message;
  final List<SupportChatOption> options;
}

abstract final class SupportChatFlows {
  static const main = SupportChatFlow(
    message:
        'Hello! I\'m Qorix Assistant.\n\nWelcome to Qorix Markets — your professional trading desk on mobile.\n\nWhat would you like help with today?',
    options: [
      SupportChatOption(label: 'How to start', value: 'how_to_start'),
      SupportChatOption(label: 'Deposits & withdrawals', value: 'wallet'),
      SupportChatOption(label: 'Investment & returns', value: 'invest'),
      SupportChatOption(label: 'Talk to expert', value: 'expert'),
    ],
  );

  static const flows = <String, SupportChatFlow>{
    'how_to_start': SupportChatFlow(
      message:
          'Getting started:\n\n1. Complete KYC from Profile\n2. Add funds via Wallet → Deposit\n3. Activate your strategy on Invest\n4. Track performance on Portfolio\n\nMost users finish setup in under 10 minutes.',
      options: [
        SupportChatOption(label: 'Wallet help', value: 'wallet'),
        SupportChatOption(label: 'Talk to expert', value: 'expert'),
        SupportChatOption(label: 'Back to menu', value: 'main_menu'),
      ],
    ),
    'wallet': SupportChatFlow(
      message:
          'Wallet help:\n\n• INR deposits — UPI or bank transfer from Deposit\n• USDT — TRC20 address shown on deposit screen\n• Withdrawals require OTP and completed KYC\n• Password change locks withdrawals for 24h',
      options: [
        SupportChatOption(label: 'Talk to expert', value: 'expert'),
        SupportChatOption(label: 'Back to menu', value: 'main_menu'),
      ],
    ),
    'invest': SupportChatFlow(
      message:
          'Investment help:\n\n• Choose Conservative, Balanced, or Growth risk\n• Top-ups earn from the next trading day\n• Risk changes queue for the next cycle\n• Protection limits are locked before capital deploys',
      options: [
        SupportChatOption(label: 'Talk to expert', value: 'expert'),
        SupportChatOption(label: 'Back to menu', value: 'main_menu'),
      ],
    ),
    'expert_requested': SupportChatFlow(
      message:
          'You\'re connected to our expert team.\n\nAn advisor will respond shortly. Type your question below.\n\nSupport hours: 9 AM – 6 PM (Mon–Sat)',
    ),
  };
}
