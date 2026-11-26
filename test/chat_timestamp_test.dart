import 'package:flutter_test/flutter_test.dart';
import 'package:driver_app_flutter/providers/chat_provider.dart';

void main() {
  group('chat UTC timestamp helpers', () {
    test('parses timezone-less backend timestamps as UTC', () {
      final parsed = parseChatUtcDateTime('2026-11-25T12:16:00');

      expect(parsed, isNotNull);
      expect(parsed!.isUtc, isTrue);
      expect(parsed.toIso8601String(), '2026-11-25T12:16:00.000Z');
    });

    test('parses Z and offset timestamps into the same UTC instant', () {
      final zulu = parseChatUtcDateTime('2026-11-25T12:16:00Z');
      final offset = parseChatUtcDateTime('2026-11-25T17:46:00+05:30');

      expect(zulu, isNotNull);
      expect(offset, isNotNull);
      expect(offset!.toUtc(), equals(zulu!.toUtc()));
    });

    test('parses Firebase epoch milliseconds as UTC', () {
      final expected = DateTime.utc(2026, 11, 25, 12, 16);
      final parsed = parseChatUtcDateTime(expected.millisecondsSinceEpoch);

      expect(parsed, equals(expected));
      expect(parsed!.isUtc, isTrue);
    });

    test('returns null for invalid, empty, and missing timestamps', () {
      expect(parseChatUtcDateTime(null), isNull);
      expect(parseChatUtcDateTime(''), isNull);
      expect(parseChatUtcDateTime('not-a-date'), isNull);
    });

    test('formats equivalent UTC inputs once in device-local AM/PM', () {
      final naive = formatChatTimestamp('2026-11-25T12:16:00');
      final zulu = formatChatTimestamp('2026-11-25T12:16:00Z');
      final offset = formatChatTimestamp('2026-11-25T17:46:00+05:30');
      final expected = parseChatUtcDateTime('2026-11-25T12:16:00Z')!;

      expect(naive, equals(zulu));
      expect(offset, equals(zulu));
      expect(naive, isNotEmpty);
      expect(naive, matches(r'(AM|PM)$'));
      expect(
        naive,
        equals(formatChatTimestamp(expected.millisecondsSinceEpoch)),
      );
    });
  });
}
