import 'package:qorix_markets_flutter/features/market/domain/entities/p2p_entities.dart';

/// Demo data — Binance P2P USDT/INR marketplace model.
abstract final class P2pDemo {
  static const pair = 'USDT/INR';
  static const fiat = 'INR';
  static const crypto = 'USDT';
  static const orderTimeoutMins = 15;

  static const paymentFilters = ['All', 'UPI', 'BANK', 'IMPS', 'NEFT', 'Paytm'];

  static const sortLabels = {
    P2pSortOption.price: 'Price',
    P2pSortOption.orders: 'Orders',
    P2pSortOption.completion: 'Completion Rate',
  };

  static const buyOffers = [
    P2POffer(
      id: 1,
      merchantName: 'QorixOfficial',
      merchantInitial: 'Q',
      orderCount: 12840,
      completionRate: 99.8,
      isVerified: true,
      isOnline: true,
      avgReleaseMins: 3,
      priceInr: 83.42,
      availableUsdt: 48500,
      minLimitInr: 500,
      maxLimitInr: 500000,
      paymentMethods: ['UPI', 'IMPS'],
      paymentDetails: {
        'UPI': P2PPaymentDetail(method: 'UPI', accountName: 'Qorix P2P Desk', accountValue: 'qorix.official@ybl'),
        'IMPS': P2PPaymentDetail(method: 'IMPS', accountName: 'Qorix Markets Pvt Ltd', accountValue: '50100234567890', bankName: 'HDFC Bank', ifsc: 'HDFC0001234'),
      },
      terms: 'Payment within 15 minutes. Do not mention crypto/USDT in payment remarks.',
    ),
    P2POffer(
      id: 2,
      merchantName: 'CryptoKing_IN',
      merchantInitial: 'C',
      orderCount: 2847,
      completionRate: 99.2,
      isVerified: true,
      isOnline: true,
      avgReleaseMins: 8,
      priceInr: 83.45,
      availableUsdt: 12500,
      minLimitInr: 5000,
      maxLimitInr: 500000,
      paymentMethods: ['UPI', 'IMPS'],
      paymentDetails: {
        'UPI': P2PPaymentDetail(method: 'UPI', accountName: 'Rajesh Kumar', accountValue: 'cryptoking@paytm'),
        'IMPS': P2PPaymentDetail(method: 'IMPS', accountName: 'Rajesh Kumar', accountValue: '33445566778899', bankName: 'ICICI Bank', ifsc: 'ICIC0000456'),
      },
      terms: 'Only IMPS/UPI from verified bank accounts. Third-party payments rejected.',
    ),
    P2POffer(
      id: 3,
      merchantName: 'SafeTrade_Pro',
      merchantInitial: 'S',
      orderCount: 1523,
      completionRate: 98.7,
      isVerified: true,
      isOnline: true,
      avgReleaseMins: 12,
      priceInr: 83.48,
      availableUsdt: 8200,
      minLimitInr: 10000,
      maxLimitInr: 300000,
      paymentMethods: ['BANK', 'NEFT'],
      paymentDetails: {
        'BANK': P2PPaymentDetail(method: 'BANK', accountName: 'SafeTrade Pro', accountValue: '11223344556677', bankName: 'Axis Bank', ifsc: 'UTIB0000789'),
        'NEFT': P2PPaymentDetail(method: 'NEFT', accountName: 'SafeTrade Pro', accountValue: '11223344556677', bankName: 'Axis Bank', ifsc: 'UTIB0000789'),
      },
    ),
    P2POffer(
      id: 4,
      merchantName: 'QuickUSDT',
      merchantInitial: 'Q',
      orderCount: 967,
      completionRate: 97.4,
      isOnline: true,
      avgReleaseMins: 5,
      priceInr: 83.40,
      availableUsdt: 4500,
      minLimitInr: 2000,
      maxLimitInr: 100000,
      paymentMethods: ['UPI', 'Paytm'],
      paymentDetails: {
        'UPI': P2PPaymentDetail(method: 'UPI', accountName: 'Amit Sharma', accountValue: 'quickusdt@oksbi'),
        'Paytm': P2PPaymentDetail(method: 'Paytm', accountName: 'Amit Sharma', accountValue: '9876543210'),
      },
    ),
    P2POffer(
      id: 5,
      merchantName: 'MumbaiExchange',
      merchantInitial: 'M',
      orderCount: 4102,
      completionRate: 99.6,
      isVerified: true,
      isOnline: false,
      avgReleaseMins: 20,
      priceInr: 83.55,
      availableUsdt: 28000,
      minLimitInr: 50000,
      maxLimitInr: 1000000,
      paymentMethods: ['BANK', 'IMPS', 'NEFT'],
      paymentDetails: {
        'BANK': P2PPaymentDetail(method: 'BANK', accountName: 'Mumbai Exchange LLP', accountValue: '99887766554433', bankName: 'SBI', ifsc: 'SBIN0001234'),
        'IMPS': P2PPaymentDetail(method: 'IMPS', accountName: 'Mumbai Exchange LLP', accountValue: '99887766554433', bankName: 'SBI', ifsc: 'SBIN0001234'),
        'NEFT': P2PPaymentDetail(method: 'NEFT', accountName: 'Mumbai Exchange LLP', accountValue: '99887766554433', bankName: 'SBI', ifsc: 'SBIN0001234'),
      },
    ),
  ];

  static const sellOffers = [
    P2POffer(
      id: 6,
      merchantName: 'BuyBack_USDT',
      merchantInitial: 'B',
      orderCount: 3210,
      completionRate: 99.4,
      isVerified: true,
      isOnline: true,
      avgReleaseMins: 10,
      priceInr: 83.38,
      availableUsdt: 20000,
      minLimitInr: 5000,
      maxLimitInr: 600000,
      paymentMethods: ['UPI', 'IMPS'],
      paymentDetails: {
        'UPI': P2PPaymentDetail(method: 'UPI', accountName: 'BuyBack Desk', accountValue: 'buyback@ybl'),
        'IMPS': P2PPaymentDetail(method: 'IMPS', accountName: 'BuyBack Desk', accountValue: '66778899001122', bankName: 'Kotak', ifsc: 'KKBK0000123'),
      },
    ),
    P2POffer(
      id: 7,
      merchantName: 'INR_Liquid',
      merchantInitial: 'I',
      orderCount: 876,
      completionRate: 97.9,
      isVerified: true,
      isOnline: true,
      priceInr: 83.35,
      availableUsdt: 9500,
      minLimitInr: 3000,
      maxLimitInr: 200000,
      paymentMethods: ['BANK', 'NEFT'],
      paymentDetails: {
        'BANK': P2PPaymentDetail(method: 'BANK', accountName: 'INR Liquid', accountValue: '44556677889900', bankName: 'HDFC Bank', ifsc: 'HDFC0009876'),
        'NEFT': P2PPaymentDetail(method: 'NEFT', accountName: 'INR Liquid', accountValue: '44556677889900', bankName: 'HDFC Bank', ifsc: 'HDFC0009876'),
      },
    ),
    P2POffer(
      id: 8,
      merchantName: 'UPI_Instant',
      merchantInitial: 'U',
      orderCount: 1120,
      completionRate: 98.3,
      isVerified: true,
      isOnline: true,
      avgReleaseMins: 4,
      priceInr: 83.30,
      availableUsdt: 6800,
      minLimitInr: 2000,
      maxLimitInr: 150000,
      paymentMethods: ['UPI'],
      paymentDetails: {
        'UPI': P2PPaymentDetail(method: 'UPI', accountName: 'Priya Nair', accountValue: 'upiinstant@ibl'),
      },
    ),
  ];

  static const userPaymentMethods = [
    P2pUserPaymentMethod(id: 1, method: 'UPI', label: 'Personal UPI', accountName: 'You', accountValue: 'trader@ybl', isDefault: true),
    P2pUserPaymentMethod(id: 2, method: 'BANK', label: 'HDFC Savings', accountName: 'You', accountValue: '50100987654321'),
  ];

  static List<P2pOrder> sampleOrders() => [
        P2pOrder(
          id: 1001,
          adId: 2,
          offer: buyOffers[1],
          isBuy: true,
          role: 'buyer',
          amountInr: 25000,
          amountUsdt: 299.58,
          paymentMethod: 'UPI',
          status: P2pOrderStatus.paid,
          createdAt: DateTime.now().subtract(const Duration(minutes: 8)),
          paymentDeadline: DateTime.now().add(const Duration(minutes: 7)),
          paymentDetail: buyOffers[1].paymentDetails['UPI']!,
        ),
        P2pOrder(
          id: 1002,
          adId: 1,
          offer: buyOffers[0],
          isBuy: true,
          role: 'buyer',
          amountInr: 10000,
          amountUsdt: 119.87,
          paymentMethod: 'UPI',
          status: P2pOrderStatus.completed,
          createdAt: DateTime.now().subtract(const Duration(days: 1)),
          paymentDeadline: DateTime.now().subtract(const Duration(days: 1)).add(const Duration(minutes: 15)),
          paymentDetail: buyOffers[0].paymentDetails['UPI']!,
        ),
      ];

  static List<P2pChatMessage> sampleChatMessages(int orderId) => [
        P2pChatMessage(
          id: 1,
          senderId: 15,
          message: 'Please pay within 15 minutes and share UTR after transfer.',
          createdAt: DateTime.now().subtract(const Duration(minutes: 8)),
        ),
        P2pChatMessage(
          id: 2,
          senderId: 42,
          message: 'Transfer done, please check.',
          createdAt: DateTime.now().subtract(const Duration(minutes: 5)),
        ),
      ];
}
