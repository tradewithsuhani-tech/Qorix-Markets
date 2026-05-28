import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:qorix_markets_flutter/app.dart';

void main() {
  testWidgets('App smoke test', (WidgetTester tester) async {
    await tester.pumpWidget(const ProviderScope(child: QorixMarketsApp()));
    await tester.pump();
    expect(find.byType(QorixMarketsApp), findsOneWidget);
  });
}
