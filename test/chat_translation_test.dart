import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:driver_app_flutter/providers/chat_provider.dart';
import 'package:driver_app_flutter/screens/chat_screen.dart';
import 'package:driver_app_flutter/services/chat_service.dart';

const Map<String, dynamic> _session = {
  'firebase_path': 'chats/tenant/booking_42/messages',
  'warning_message':
      'For your safety, please keep the conversation inside the app.',
  'driver_language': 'hi',
};

Map<String, dynamic> _rawMessage({
  String translatedText = '',
  String originalLanguage = 'en',
}) {
  return {
    'id': 7,
    'firebase_message_id': 'fb-7',
    'sender_type': 'employee',
    'is_system_message': false,
    'original_text': 'Hello',
    'original_language': originalLanguage,
    'translated_text': translatedText,
    'created_at': '2026-11-25T16:46:00Z',
  };
}

class _FakeChatService implements ChatService {
  _FakeChatService({this.result, this.error});

  Map<String, dynamic>? result;
  String? error;
  int translateCalls = 0;
  Map<String, dynamic>? lastRequest;

  @override
  Future<Map<String, dynamic>> openSession(int bookingId) async => {
    'success': true,
    'data': _session,
  };

  @override
  Future<Map<String, dynamic>> sendMessage(int bookingId, String text) async =>
      {'success': true, 'data': _rawMessage()};

  @override
  Future<Map<String, dynamic>> getMessages(
    int bookingId, {
    int skip = 0,
    int limit = 50,
  }) async {
    return {
      'success': true,
      'data': {
        'session': _session,
        'messages': [_rawMessage()],
      },
    };
  }

  @override
  Future<Map<String, dynamic>> translateMessage(
    int bookingId, {
    int? messageId,
    String? firebaseMessageId,
    String? sourceLanguage,
    required String targetLanguage,
  }) async {
    translateCalls++;
    lastRequest = {
      'bookingId': bookingId,
      'messageId': messageId,
      'firebaseMessageId': firebaseMessageId,
      'sourceLanguage': sourceLanguage,
      'targetLanguage': targetLanguage,
    };
    if (error != null) return {'success': false, 'error': error};
    return {
      'success': true,
      'data':
          result ??
          {'translated_text': 'नमस्ते', 'translation_status': 'translated'},
    };
  }

  @override
  Future<Map<String, dynamic>> setLanguage(
    int bookingId,
    String language,
  ) async => {'success': true, 'data': _session};

  @override
  Future<Map<String, dynamic>> getSupportedLanguages() async => {
    'success': true,
    'data': {
      'languages': {'hi': 'Hindi'},
    },
  };
}

class _FakeChatProvider extends ChatProvider {
  _FakeChatProvider(
    this._fakeMessages, {
    this.translating = false,
    this.translationError,
    this.translationStatus,
  }) : super(chatService: _FakeChatService());

  final List<Map<String, dynamic>> _fakeMessages;
  final bool translating;
  final String? translationError;
  final String? translationStatus;

  int translateCalls = 0;

  @override
  List<Map<String, dynamic>> get messages => _fakeMessages;

  @override
  Map<String, dynamic>? get session => _session;

  @override
  Map<String, String> get supportedLanguages => const {'hi': 'Hindi'};

  @override
  int? get currentBookingId => 42;

  @override
  bool isMessageTranslating(Map<String, dynamic> msg) => translating;

  @override
  String? messageTranslationError(Map<String, dynamic> msg) => translationError;

  @override
  String? messageTranslationStatus(Map<String, dynamic> msg) =>
      translationStatus;

  @override
  Future<bool> translateMessage(int bookingId, Map<String, dynamic> msg) async {
    translateCalls++;
    return true;
  }

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
  test('translateMessage passes session target and source language', () async {
    final service = _FakeChatService();
    final provider = ChatProvider(chatService: service);
    await provider.openSession(42);
    await provider.loadMessages(42);
    final message = provider.messages.single;

    final ok = await provider.translateMessage(42, message);

    expect(ok, isTrue);
    expect(service.translateCalls, 1);
    expect(service.lastRequest!['targetLanguage'], 'hi');
    expect(service.lastRequest!['sourceLanguage'], 'en');
    expect(service.lastRequest!['messageId'], 7);
    expect(service.lastRequest!['firebaseMessageId'], 'fb-7');
    expect(provider.messages.single['original_text'], 'Hello');
    expect(provider.messages.single['translated_text'], 'नमस्ते');
  });

  test('translateMessage prevents duplicate in-flight requests', () async {
    final service = _FakeChatService();
    final provider = ChatProvider(chatService: service);
    await provider.openSession(42);
    await provider.loadMessages(42);
    final message = provider.messages.single;

    await Future.wait([
      provider.translateMessage(42, message),
      provider.translateMessage(42, message),
    ]);

    expect(service.translateCalls, 1);
  });

  test('translateMessage reuses an existing translation', () async {
    final service = _FakeChatService(
      result: {'translated_text': 'should-not-be-used'},
    );
    final provider = ChatProvider(chatService: service);
    await provider.openSession(42);
    await provider.loadMessages(42);
    final providerWithTranslation = ChatProvider(chatService: service);
    await providerWithTranslation.openSession(42);
    service.result = null;
    service.error = null;

    final ok = await providerWithTranslation.translateMessage(
      42,
      _rawMessage(translatedText: 'नमस्ते'),
    );

    expect(ok, isTrue);
    expect(service.translateCalls, 0);
    expect(
      providerWithTranslation.messageTranslationStatus(
        _rawMessage(translatedText: 'नमस्ते'),
      ),
      'reused',
    );
  });

  test('translateMessage records failure and allows retry', () async {
    final service = _FakeChatService(error: 'Translation failed');
    final provider = ChatProvider(chatService: service);
    await provider.openSession(42);
    await provider.loadMessages(42);

    final failed = await provider.translateMessage(
      42,
      provider.messages.single,
    );
    expect(failed, isFalse);
    expect(
      provider.messageTranslationError(provider.messages.single),
      'Translation failed',
    );

    service.error = null;
    final retried = await provider.translateMessage(
      42,
      provider.messages.single,
    );
    expect(retried, isTrue);
    expect(service.translateCalls, 2);
    expect(provider.messageTranslationError(provider.messages.single), isNull);
  });

  testWidgets('renders original, translation, and per-message action', (
    WidgetTester tester,
  ) async {
    final provider = _FakeChatProvider([_rawMessage(translatedText: 'नमस्ते')]);

    await tester.pumpWidget(
      ChangeNotifierProvider<ChatProvider>.value(
        value: provider,
        child: const MaterialApp(home: ChatScreen(bookingId: 42)),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Hello'), findsOneWidget);
    expect(find.text('नमस्ते'), findsOneWidget);
    expect(find.textContaining('Translate to Hindi'), findsOneWidget);
  });

  testWidgets('renders per-message loading and retry states', (
    WidgetTester tester,
  ) async {
    final loadingProvider = _FakeChatProvider([
      _rawMessage(),
    ], translating: true);
    await tester.pumpWidget(
      ChangeNotifierProvider<ChatProvider>.value(
        value: loadingProvider,
        child: const MaterialApp(home: ChatScreen(bookingId: 42)),
      ),
    );
    await tester.pump();
    expect(find.text('Translating...'), findsOneWidget);

    final errorProvider = _FakeChatProvider(
      [_rawMessage()],
      translationError: 'Translation failed',
      translationStatus: 'failed',
    );
    await tester.pumpWidget(
      ChangeNotifierProvider<ChatProvider>.value(
        value: errorProvider,
        child: const MaterialApp(home: ChatScreen(bookingId: 42)),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('Translation failed'), findsOneWidget);
    expect(find.text('Retry translation'), findsOneWidget);
  });
}
