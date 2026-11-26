import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:driver_app_flutter/providers/chat_provider.dart';
import 'package:driver_app_flutter/screens/chat_screen.dart';

class _FakeChatProvider extends ChatProvider {
  _FakeChatProvider(this._fakeMessages);

  final List<Map<String, dynamic>> _fakeMessages;

  @override
  List<Map<String, dynamic>> get messages => _fakeMessages;

  @override
  Map<String, dynamic>? get session => {
    'firebase_path': 'chats/tenant/booking_42/messages',
    'warning_message':
        'For your safety, please keep the conversation inside the app.',
  };

  @override
  int? get currentBookingId => 42;

  @override
  Future<void> loadSupportedLanguages() async {}

  @override
  Future<bool> openSession(int bookingId) async => true;

  @override
  Future<void> loadMessages(
    int bookingId, {
    int skip = 0,
    int limit = 50,
  }) async {}

  @override
  void listenToFirebase(String firebasePath, {int startAfterTimestamp = 0}) {}
}

void main() {
  const warning =
      'For your safety, please keep the conversation inside the app.';
  const createdAt = '2026-11-25T16:46:00Z';

  testWidgets('renders one safety warning and UTC-normalized timestamp', (
    WidgetTester tester,
  ) async {
    final provider = _FakeChatProvider([
      {
        'id': 1,
        'sender_type': 'system',
        'is_system_message': true,
        'original_text': warning,
        'translated_text': warning,
        'created_at': createdAt,
        '_ts': 1000,
      },
      {
        'id': 2,
        'sender_type': 'driver',
        'is_system_message': false,
        'original_text': 'On my way',
        'translated_text': 'On my way',
        'created_at': createdAt,
        '_ts': 2000,
      },
    ]);

    await tester.pumpWidget(
      ChangeNotifierProvider<ChatProvider>.value(
        value: provider,
        child: const MaterialApp(home: ChatScreen(bookingId: 42)),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text(warning), findsOneWidget);
    expect(find.text(formatChatTimestamp(createdAt)), findsOneWidget);
  });
}
