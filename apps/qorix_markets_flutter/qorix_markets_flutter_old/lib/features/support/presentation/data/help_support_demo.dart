import 'package:qorix_markets_flutter/data/models/support_models.dart';

abstract final class HelpSupportDemo {
  static const contact = SupportContactModel();

  static const faqs = [
    SupportFaqModel(
      id: 'deposit',
      category: 'Wallet',
      question: 'How long do INR deposits take?',
      answer:
          'UPI deposits are usually credited within 2 minutes after UTR verification. Bank transfers may take up to 24 hours depending on the merchant release time.',
    ),
    SupportFaqModel(
      id: 'withdraw',
      category: 'Wallet',
      question: 'When can I withdraw after changing my password?',
      answer:
          'Withdrawals are locked for 24 hours after a password change. Deposits and trading continue normally during this period.',
    ),
    SupportFaqModel(
      id: 'kyc',
      category: 'Account',
      question: 'Why is my KYC still pending?',
      answer:
          'Document review typically completes within 24–48 hours. Ensure photos are clear and match your registered name. Contact support if pending beyond 3 business days.',
    ),
    SupportFaqModel(
      id: 'invest',
      category: 'Invest',
      question: 'When does added capital start earning?',
      answer:
          'Top-ups and new deployments begin earning from the next trading day after activation. Pending amounts show in your Invest dashboard until processed.',
    ),
    SupportFaqModel(
      id: 'p2p',
      category: 'P2P',
      question: 'What if a P2P counterparty does not release?',
      answer:
          'Open a dispute from the order detail screen and share payment proof in chat. Our team reviews disputes during support hours.',
    ),
    SupportFaqModel(
      id: 'security',
      category: 'Security',
      question: 'How do I sign out other devices?',
      answer:
          'Go to Profile → Security → My Devices. You can revoke individual sessions or sign out all other devices instantly.',
    ),
  ];
}
