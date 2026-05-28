/// Normalizes `/api/v1` envelope shapes (`data`, `meta`, nested objects).
abstract final class ApiJson {
  static Map<String, dynamic> object(dynamic raw) {
    if (raw is! Map) return {};
    final map = Map<String, dynamic>.from(raw);
    final data = map['data'];
    if (data is Map) return Map<String, dynamic>.from(data);
    return map;
  }

  static List<Map<String, dynamic>> list(dynamic raw, {String listKey = 'data'}) {
    if (raw is List) {
      return raw.whereType<Map>().map(Map<String, dynamic>.from).toList();
    }
    if (raw is! Map) return const [];
    final map = Map<String, dynamic>.from(raw);
    final direct = map[listKey];
    if (direct is List) {
      return direct.whereType<Map>().map(Map<String, dynamic>.from).toList();
    }
    final nested = map['data'];
    if (nested is List) {
      return nested.whereType<Map>().map(Map<String, dynamic>.from).toList();
    }
    if (nested is Map) {
      for (final key in ['items', 'history', 'transactions', 'bots', 'trades']) {
        final v = nested[key];
        if (v is List) return v.whereType<Map>().map(Map<String, dynamic>.from).toList();
      }
    }
    for (final key in ['items', 'history', 'transactions', 'bots', 'trades']) {
      final v = map[key];
      if (v is List) return v.whereType<Map>().map(Map<String, dynamic>.from).toList();
    }
    return const [];
  }

  static ApiPageMeta meta(dynamic raw) {
    if (raw is! Map) return const ApiPageMeta();
    final map = Map<String, dynamic>.from(raw);
    final metaMap = map['meta'] is Map
        ? Map<String, dynamic>.from(map['meta'] as Map)
        : map['pagination'] is Map
            ? Map<String, dynamic>.from(map['pagination'] as Map)
            : map;
    final page = _int(metaMap['page'] ?? metaMap['currentPage'], fallback: 1);
    final limit = _int(metaMap['limit'] ?? metaMap['pageSize'], fallback: 20);
    final total = _int(metaMap['total'] ?? metaMap['totalCount'], fallback: 0);
    final hasMore = metaMap['hasMore'] as bool? ??
        metaMap['hasNextPage'] as bool? ??
        (total > 0 ? page * limit < total : false);
    return ApiPageMeta(page: page, limit: limit, total: total, hasMore: hasMore);
  }

  static double asDouble(dynamic v, {double fallback = 0}) =>
      v is num ? v.toDouble() : double.tryParse('$v') ?? fallback;

  static int asInt(dynamic v, {int fallback = 0}) => _int(v, fallback: fallback);

  static int _int(dynamic v, {required int fallback}) {
    if (v is int) return v;
    if (v is num) return v.toInt();
    return int.tryParse('$v') ?? fallback;
  }
}

class ApiPageMeta {
  const ApiPageMeta({
    this.page = 1,
    this.limit = 20,
    this.total = 0,
    this.hasMore = false,
  });

  final int page;
  final int limit;
  final int total;
  final bool hasMore;
}
