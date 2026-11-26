import 'package:flutter_test/flutter_test.dart';
import 'package:driver_app_flutter/providers/chat_provider.dart';

void main() {
  const warning =
      'For your safety, please keep the conversation inside the app.';

  Map<String, dynamic> warningMessage({
    required int id,
    String? firebaseKey,
    int ts = 1000,
  }) {
    return {
      'id': id,
      'firebase_message_id': firebaseKey,
      'sender_type': 'system',
      'is_system_message': true,
      'original_text': warning,
      'translated_text': warning,
      'created_at': DateTime.fromMillisecondsSinceEpoch(
        ts,
        isUtc: true,
      ).toIso8601String(),
      '_ts': ts,
    };
  }

  Map<String, dynamic> userMessage(int ts) {
    return {
      'id': ts,
      'sender_type': 'driver',
      'is_system_message': false,
      'original_text': warning,
      'translated_text': warning,
      '_ts': ts,
    };
  }

  group('chat safety warning dedupe', () {
    test(
      'keeps only one warning from REST and Firebase with different IDs',
      () {
        final result = dedupeChatMessages([
          warningMessage(id: 1),
          warningMessage(id: 0, firebaseKey: 'warning-uuid'),
        ], warning);

        expect(result, hasLength(1));
        expect(result.single['id'], 1);
        expect(isSafetyWarningMessage(result.single, warning), isTrue);
      },
    );

    test('keeps only one warning across reopen and reconnect events', () {
      final result = dedupeChatMessages([
        warningMessage(id: 1),
        warningMessage(id: 1),
        warningMessage(id: 2, firebaseKey: 'warning-uuid'),
        warningMessage(id: 3, firebaseKey: 'another-uuid'),
      ], warning);

      expect(
        result.where((m) => isSafetyWarningMessage(m, warning)),
        hasLength(1),
      );
    });

    test('does not remove non-system messages with the same text', () {
      final result = dedupeChatMessages([
        warningMessage(id: 1),
        userMessage(2000),
      ], warning);

      expect(result, hasLength(2));
      expect(result.last['sender_type'], 'driver');
    });

    test('pins the canonical warning to the top when sorting', () {
      final sorted = sortChatMessages([
        userMessage(1000),
        warningMessage(id: 1, ts: 9000),
        userMessage(3000),
      ], warning);

      expect(sorted, hasLength(3));
      expect(isSafetyWarningMessage(sorted.first, warning), isTrue);
    });

    test('preserves chronological order for non-warning messages', () {
      final sorted = sortChatMessages([
        userMessage(3000),
        userMessage(1000),
        userMessage(2000),
      ], warning);

      expect(sorted.map((m) => m['_ts']).toList(), equals([1000, 2000, 3000]));
    });
  });
}
