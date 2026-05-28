import 'package:flutter/material.dart';

import 'package:qorix_markets_flutter/core/theme/app_colors.dart';

/// UI-demo data for deposit flows (Crypto + INR).
abstract final class DepositDemo {
  // Crypto
  static const cryptoMinUsdt = 10.0;
  static const cryptoNetwork = 'TRC20';
  static const cryptoToken = 'USDT';
  static const cryptoAddress = 'TXkP3vN8qR2mL5wY9zH4jF6gD1cB7aE3sK';

  static const cryptoQuickAmounts = [60.0, 120.0, 300.0, 600.0];
  static const inrQuickAmounts = [5000.0, 10000.0, 25000.0, 50000.0];

  // INR
  static const inrMin = 500.0;
  static const upiId = 'qorixmarkets@ybl';
  static const bankName = 'HDFC Bank';
  static const accountName = 'Qorix Markets Pvt Ltd';
  static const accountNumber = '50200012345678';
  static const ifsc = 'HDFC0001234';
  static const inrUsdtRate = 83.50;
}

enum InrPaymentMethod { upi, netBanking, impsNeft }

enum CryptoAsset { usdt, btc, eth, sol, bnb, trx }

class DepositInrMethodOption {
  const DepositInrMethodOption({
    required this.id,
    required this.title,
    required this.subtitle,
    required this.icon,
  });

  final InrPaymentMethod id;
  final String title;
  final String subtitle;
  final IconData icon;
}

class DepositCryptoOption {
  const DepositCryptoOption({
    required this.id,
    required this.symbol,
    required this.name,
    required this.network,
    required this.color,
    required this.iconLetter,
  });

  final CryptoAsset id;
  final String symbol;
  final String name;
  final String network;
  final Color color;
  final String iconLetter;
}

abstract final class DepositOptions {
  static const inrMethods = [
    DepositInrMethodOption(
      id: InrPaymentMethod.upi,
      title: 'UPI',
      subtitle: 'Instant · No charges',
      icon: Icons.bolt_rounded,
    ),
    DepositInrMethodOption(
      id: InrPaymentMethod.netBanking,
      title: 'Net Banking',
      subtitle: 'Within 30 mins · Free',
      icon: Icons.language_rounded,
    ),
    DepositInrMethodOption(
      id: InrPaymentMethod.impsNeft,
      title: 'IMPS / NEFT',
      subtitle: '1–2 hrs · Free',
      icon: Icons.send_rounded,
    ),
  ];

  static const cryptoAssets = [
    DepositCryptoOption(
      id: CryptoAsset.usdt,
      symbol: 'USDT',
      name: 'Tether',
      network: 'TRC20 / ERC20',
      color: Color(0xFF26A17B),
      iconLetter: '₮',
    ),
    DepositCryptoOption(
      id: CryptoAsset.btc,
      symbol: 'BTC',
      name: 'Bitcoin',
      network: 'Bitcoin Network',
      color: Color(0xFFF7931A),
      iconLetter: '₿',
    ),
    DepositCryptoOption(
      id: CryptoAsset.eth,
      symbol: 'ETH',
      name: 'Ethereum',
      network: 'ERC20',
      color: Color(0xFF627EEA),
      iconLetter: 'Ξ',
    ),
    DepositCryptoOption(
      id: CryptoAsset.sol,
      symbol: 'SOL',
      name: 'Solana',
      network: 'Solana Network',
      color: Color(0xFF9945FF),
      iconLetter: 'S',
    ),
    DepositCryptoOption(
      id: CryptoAsset.bnb,
      symbol: 'BNB',
      name: 'BNB',
      network: 'BEP20',
      color: Color(0xFFF3BA2F),
      iconLetter: 'B',
    ),
    DepositCryptoOption(
      id: CryptoAsset.trx,
      symbol: 'TRX',
      name: 'Tron',
      network: 'TRC20',
      color: Color(0xFFEF0027),
      iconLetter: 'T',
    ),
  ];

  static DepositCryptoOption crypto(CryptoAsset id) =>
      cryptoAssets.firstWhere((c) => c.id == id);

  static DepositInrMethodOption inr(InrPaymentMethod id) =>
      inrMethods.firstWhere((m) => m.id == id);
}

class P2pMerchant {
  const P2pMerchant({
    required this.id,
    required this.name,
    required this.limitLabel,
    required this.avatarLetter,
    required this.ringColor,
    required this.upiId,
    required this.referenceCode,
    required this.accountHolder,
    required this.accountNumber,
    required this.ifsc,
    required this.bankName,
    this.online = true,
  });

  final String id;
  final String name;
  final String limitLabel;
  final String avatarLetter;
  final Color ringColor;
  final String upiId;
  final String referenceCode;
  final String accountHolder;
  final String accountNumber;
  final String ifsc;
  final String bankName;
  final bool online;
}

abstract final class DepositMerchants {
  static const list = [
    P2pMerchant(
      id: 'small_shark',
      name: 'SMALL SHARK',
      limitLabel: 'LIMIT ₹1,000 - ₹500L',
      avatarLetter: 'S',
      ringColor: AppColors.authGreen,
      upiId: '377665@ybl',
      referenceCode: 'QX-SDZQCY',
      accountHolder: 'VIMLESH KUMAR',
      accountNumber: '55550101899423',
      ifsc: 'FDRL0005555',
      bankName: 'Federal Bank',
    ),
    P2pMerchant(
      id: 'p2p_trade',
      name: 'P2P TRADE',
      limitLabel: 'LIMIT ₹100 - ₹5L',
      avatarLetter: 'P',
      ringColor: Color(0xFF4DA3FF),
      upiId: 'p2ptrade@ybl',
      referenceCode: 'QX-T8K241',
      accountHolder: 'P2P TRADE SERVICES',
      accountNumber: '50200098765432',
      ifsc: 'HDFC0001234',
      bankName: 'HDFC Bank',
    ),
    P2pMerchant(
      id: 'quick_inr',
      name: 'QUICK INR',
      limitLabel: 'LIMIT ₹500 - ₹2L',
      avatarLetter: 'Q',
      ringColor: Color(0xFFFFB74D),
      upiId: 'quickinr@paytm',
      referenceCode: 'QX-Q5M772',
      accountHolder: 'QUICK INR PVT LTD',
      accountNumber: '60100234567890',
      ifsc: 'ICIC0000456',
      bankName: 'ICICI Bank',
    ),
  ];

  static P2pMerchant byId(String id) => list.firstWhere((m) => m.id == id);

  static P2pMerchant resolve(String? id, List<P2pMerchant> merchants) {
    if (id != null) {
      for (final m in merchants) {
        if (m.id == id) return m;
      }
    }
    return merchants.isNotEmpty ? merchants.first : list.first;
  }
}
