class MarketIndicatorsModel {
  const MarketIndicatorsModel({
    this.fearGreed = 50,
    this.btcDominance = 52,
    this.volatilityIndex = 18,
  });

  factory MarketIndicatorsModel.fromJson(Map<String, dynamic> json) => MarketIndicatorsModel(
        fearGreed: (json['fearGreed'] as num?)?.toDouble() ?? 50,
        btcDominance: (json['btcDominance'] as num?)?.toDouble() ?? 52,
        volatilityIndex: (json['volatilityIndex'] as num?)?.toDouble() ?? 18,
      );

  final double fearGreed;
  final double btcDominance;
  final double volatilityIndex;
}
