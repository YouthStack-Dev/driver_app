import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:firebase_database/firebase_database.dart';
import 'package:intl/intl.dart';
import '../services/chat_service.dart';

DateTime? parseChatUtcDateTime(Object? raw) {
  if (raw is DateTime) return raw.toUtc();
  if (raw is int) {
    return DateTime.fromMillisecondsSinceEpoch(raw, isUtc: true);
  }
  if (raw is num) {
    return DateTime.fromMillisecondsSinceEpoch(raw.round(), isUtc: true);
  }
  if (raw is! String) return null;

  var text = raw.trim();
  if (text.isEmpty) return null;
  text = text.replaceFirst(' ', 'T');

  final hasZone = RegExp(r'(?:Z|[+-]\d{2}:?\d{2})$').hasMatch(text);
  if (!hasZone) text = '${text}Z';
  return DateTime.tryParse(text)?.toUtc();
}

String formatChatTimestamp(Object? raw) {
  final parsed = parseChatUtcDateTime(raw);
  if (parsed == null) return '';
  return DateFormat('h:mm a').format(parsed.toLocal());
}

String? messageFirebaseKey(Map<String, dynamic> msg) {
  final key = msg['firebase_message_id']?.toString().trim();
  if (key == null || key.isEmpty) return null;
  return key;
}

int? messageIdOf(Map<String, dynamic> msg) {
  final raw = msg['id'];
  if (raw is int) return raw;
  if (raw == null) return null;
  return int.tryParse(raw.toString().trim());
}

String? chatTranslationIdentity(Map<String, dynamic> msg) {
  final key = messageFirebaseKey(msg);
  if (key != null) return 'firebase:$key';
  final id = messageIdOf(msg);
  if (id != null) return 'id:$id';
  return null;
}

String _normalizedWarningText(Object? raw) {
  if (raw == null) return '';
  return raw.toString().trim().replaceAll(RegExp(r'\s+'), ' ').toLowerCase();
}

bool isSafetyWarningMessage(Map<String, dynamic> msg, String? warningText) {
  final normalizedWarning = _normalizedWarningText(warningText);
  if (normalizedWarning.isEmpty) return false;

  final senderType = msg['sender_type']?.toString().toLowerCase();
  final isSystem =
      msg['is_system_message'] == true ||
      msg['is_system'] == true ||
      senderType == 'system';
  if (!isSystem) return false;

  return _normalizedWarningText(msg['original_text']) == normalizedWarning ||
      _normalizedWarningText(msg['translated_text']) == normalizedWarning;
}

bool shouldSkipSafetyWarning(
  List<Map<String, dynamic>> kept,
  Map<String, dynamic> candidate,
  String? warningText,
) {
  if (!isSafetyWarningMessage(candidate, warningText)) return false;
  return kept.any((msg) => isSafetyWarningMessage(msg, warningText));
}

List<Map<String, dynamic>> dedupeChatMessages(
  Iterable<Map<String, dynamic>> messages,
  String? warningText, {
  void Function(Map<String, dynamic> duplicate)? onDuplicate,
  void Function(Map<String, dynamic> duplicate, Map<String, dynamic> canonical)?
  onWarningDuplicate,
}) {
  final seenKeys = <String>{};
  final seenIds = <int>{};
  final result = <Map<String, dynamic>>[];

  Map<String, dynamic> findCanonicalWarning() => result.firstWhere(
    (msg) => isSafetyWarningMessage(msg, warningText),
    orElse: () => <String, dynamic>{},
  );

  for (final msg in messages) {
    final key = messageFirebaseKey(msg);
    final id = messageIdOf(msg);
    final duplicateIdentity =
        (key != null && seenKeys.contains(key)) ||
        (id != null && seenIds.contains(id));

    if (key != null) seenKeys.add(key);
    if (id != null) seenIds.add(id);

    if (duplicateIdentity) {
      if (isSafetyWarningMessage(msg, warningText)) {
        final canonical = findCanonicalWarning();
        if (canonical.isNotEmpty) onWarningDuplicate?.call(msg, canonical);
      }
      onDuplicate?.call(msg);
      continue;
    }

    if (shouldSkipSafetyWarning(result, msg, warningText)) {
      final canonical = findCanonicalWarning();
      if (canonical.isNotEmpty) onWarningDuplicate?.call(msg, canonical);
      onDuplicate?.call(msg);
      continue;
    }

    result.add(msg);
  }

  return result;
}

List<Map<String, dynamic>> sortChatMessages(
  Iterable<Map<String, dynamic>> messages,
  String? warningText,
) {
  final sorted = List<Map<String, dynamic>>.from(messages);
  sorted.sort((a, b) {
    final aWarning = isSafetyWarningMessage(a, warningText);
    final bWarning = isSafetyWarningMessage(b, warningText);
    if (aWarning != bWarning) return aWarning ? -1 : 1;

    final timestampCompare = ((a['_ts'] as int?) ?? 0).compareTo(
      (b['_ts'] as int?) ?? 0,
    );
    if (timestampCompare != 0) return timestampCompare;

    final keyCompare = (messageFirebaseKey(a) ?? '').compareTo(
      messageFirebaseKey(b) ?? '',
    );
    if (keyCompare != 0) return keyCompare;

    return (messageIdOf(a) ?? 0).compareTo(messageIdOf(b) ?? 0);
  });
  return sorted;
}

bool _isBlankChatValue(Object? value) =>
    value == null || (value is String && value.trim().isEmpty);

/// Manages chat state for a single booking session.
///
/// Lifecycle:
///   1. Call [openSession] → retrieves (or creates) the session, sets
///      [session] and [currentBookingId].
///   2. Call [loadMessages] → fills [messages] from the REST history endpoint,
///      merging any Firebase-only messages that haven't been flushed to REST yet.
///   3. Call [listenToFirebase] → attaches RTDB childAdded / childChanged
///      listeners so new messages and translation patches arrive live.
///      Idempotent — calling again with the same path is a no-op.
///   4. Call [clearChat] only when switching to a *different* booking or
///      logging out. Do NOT call it (or [cancelFirebaseListener]) on ordinary
///      screen disposal — the listener intentionally stays alive so messages
///      received while the chat screen is in the background are not missed.
class ChatProvider extends ChangeNotifier {
  ChatProvider({ChatService? chatService})
    : _chatService = chatService ?? ChatService();

  final ChatService _chatService;

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------

  Map<String, dynamic>? _session;
  List<Map<String, dynamic>> _messages = [];
  bool _isLoading = false;
  bool _isSending = false;
  String? _error;
  Map<String, String> _supportedLanguages = {};
  final Map<String, String> _translationErrors = {};
  final Map<String, String> _translationStatuses = {};
  final Set<String> _translationInFlight = {};

  Map<String, dynamic>? get session => _session;
  List<Map<String, dynamic>> get messages => List.unmodifiable(_messages);
  bool get isLoading => _isLoading;
  bool get isSending => _isSending;
  String? get error => _error;
  Map<String, String> get supportedLanguages => _supportedLanguages;

  bool isMessageTranslating(Map<String, dynamic> msg) {
    final identity = chatTranslationIdentity(msg);
    return identity != null && _translationInFlight.contains(identity);
  }

  String? messageTranslationError(Map<String, dynamic> msg) {
    final identity = chatTranslationIdentity(msg);
    return identity == null ? null : _translationErrors[identity];
  }

  String? messageTranslationStatus(Map<String, dynamic> msg) {
    final identity = chatTranslationIdentity(msg);
    return identity == null ? null : _translationStatuses[identity];
  }

  /// Driver's currently selected language code (default 'en').
  String get driverLanguage => (session?['driver_language'] as String?) ?? 'en';

  // ---------------------------------------------------------------------------
  // Booking / Firebase listener tracking
  // ---------------------------------------------------------------------------

  /// The booking ID currently loaded in this provider.
  /// Used by ChatScreen to decide whether a full reset is needed on re-open.
  int? _currentBookingId;
  String? _currentFirebasePath;

  int? get currentBookingId => _currentBookingId;
  String? get currentFirebasePath => _currentFirebasePath;

  StreamSubscription<DatabaseEvent>? _childAddedSub;
  StreamSubscription<DatabaseEvent>? _childChangedSub;

  /// Set to true when the RTDB subscription receives an error event.
  /// Forces a full re-subscription on the next [listenToFirebase] call even
  /// when the path hasn't changed — the most common cause is a Firebase
  /// security-rule denial or a stale connection that needs to be reset.
  bool _listenerHadError = false;

  final Set<String> _knownKeys = {};
  final Set<int> _knownIds = {};

  Future<bool>? _openSessionFuture;
  int? _openingBookingId;
  int _openGeneration = 0;

  /// The millisecond-epoch timestamp of the most recent message returned by
  /// the last [loadMessages] call.  Passed to [listenToFirebase] as
  /// [startAfterTimestamp] so the RTDB query only delivers messages that are
  /// genuinely newer than the REST history — avoids re-delivering all 79+
  /// existing messages as [childAdded] events on every subscription.
  int _lastRestTimestamp = 0;
  int get lastRestTimestamp => _lastRestTimestamp;

  String? get _warningText => session?['warning_message']?.toString();

  // ---------------------------------------------------------------------------
  // Session
  // ---------------------------------------------------------------------------

  Future<bool> openSession(int bookingId) {
    final pending = _openSessionFuture;
    if (pending != null && _openingBookingId == bookingId) return pending;

    final generation = ++_openGeneration;
    final future = _openSessionInternal(bookingId, generation);
    _openSessionFuture = future;
    _openingBookingId = bookingId;
    unawaited(
      future.whenComplete(() {
        if (identical(_openSessionFuture, future)) {
          _openSessionFuture = null;
          _openingBookingId = null;
        }
      }),
    );
    return future;
  }

  Future<bool> _openSessionInternal(int bookingId, int generation) async {
    _setLoading(true);
    _error = null;
    try {
      final result = await _chatService.openSession(bookingId);
      if (generation != _openGeneration) return false;
      if (result['success'] == true) {
        final opened = _asMap(result['data']);
        _session = _session == null
            ? opened
            : _mergeChatSessions(_session!, opened);
        _currentBookingId = bookingId;
        return true;
      }
      _error = result['error']?.toString();
      return false;
    } finally {
      if (generation == _openGeneration) _setLoading(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Message history (REST)
  // ---------------------------------------------------------------------------

  /// Loads (or refreshes) the message history from REST.
  ///
  /// Merges with any Firebase-only messages currently in [_messages] that
  /// haven't been flushed to REST yet, so live-arriving messages are never
  /// lost during a refresh.
  Future<void> loadMessages(
    int bookingId, {
    int skip = 0,
    int limit = 50,
  }) async {
    _setLoading(true);
    _error = null;
    try {
      final previousSession = _session;
      final result = await _chatService.getMessages(
        bookingId,
        skip: skip,
        limit: limit,
      );
      if (result['success'] == true) {
        final data = _asMap(result['data']);
        if (data['session'] != null) {
          final incoming = _asMap(data['session']);
          _session = previousSession == null
              ? incoming
              : _mergeChatSessions(previousSession, incoming);
        }

        final rawList = data['messages'] as List? ?? [];
        final restMessages = rawList
            .map((m) => _normalizeMsg(_asMap(m)))
            .toList();

        final restKeys = <String>{};
        final restIds = <int>{};
        for (final msg in restMessages) {
          final key = messageFirebaseKey(msg);
          final id = messageIdOf(msg);
          if (key != null) restKeys.add(key);
          if (id != null) restIds.add(id);
        }

        final firebaseOnly = _messages.where((m) {
          final key = messageFirebaseKey(m);
          final id = messageIdOf(m);
          final inRest =
              (key != null && restKeys.contains(key)) ||
              (id != null && restIds.contains(id));
          return key != null && !inRest;
        }).toList();

        _messages = dedupeChatMessages(
          [...restMessages, ...firebaseOnly],
          _warningText,
          onWarningDuplicate: _linkWarningIdentity,
        );
        _sortMessages();

        _knownKeys.clear();
        _knownIds.clear();
        _translationErrors.clear();
        _translationStatuses.clear();
        _translationInFlight.clear();
        for (final msg in _messages) {
          _markMessageSeen(msg);
        }

        var latest = 0;
        for (final msg in _messages) {
          final ts = (msg['_ts'] as int?) ?? 0;
          if (ts > latest) latest = ts;
        }
        _lastRestTimestamp = latest;
      } else {
        _error = result['error']?.toString();
      }
    } finally {
      _setLoading(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Send message
  // ---------------------------------------------------------------------------

  Future<bool> sendMessage(int bookingId, String text) async {
    _isSending = true;
    notifyListeners();
    try {
      final result = await _chatService.sendMessage(bookingId, text);
      if (result['success'] == true) {
        final msg = _normalizeMsg(_asMap(result['data']));
        _addIfNew(msg);
        return true;
      }
      _error = result['error']?.toString();
      notifyListeners();
      return false;
    } finally {
      _isSending = false;
      notifyListeners();
    }
  }

  Future<bool> translateMessage(
    int bookingId,
    Map<String, dynamic> message,
  ) async {
    final identity = chatTranslationIdentity(message);
    if (identity == null) return false;
    if (_translationInFlight.contains(identity)) return false;

    final originalText = (message['original_text'] as String?) ?? '';
    final existing = (message['translated_text'] as String?)?.trim();
    if (existing != null &&
        existing.isNotEmpty &&
        existing != originalText.trim()) {
      _translationErrors.remove(identity);
      _translationStatuses[identity] = 'reused';
      _applyTranslatedText(identity, existing);
      notifyListeners();
      return true;
    }

    final sourceRaw = message['original_language']?.toString().trim();
    final sourceLanguage = sourceRaw != null && sourceRaw.isNotEmpty
        ? sourceRaw
        : null;
    final targetLanguage = driverLanguage;

    if (sourceLanguage != null && sourceLanguage == targetLanguage) {
      _translationErrors.remove(identity);
      _translationStatuses[identity] = 'same_language';
      notifyListeners();
      return true;
    }

    if (originalText.trim().isEmpty) {
      _translationErrors.remove(identity);
      _translationStatuses[identity] = 'empty';
      notifyListeners();
      return false;
    }

    _translationInFlight.add(identity);
    _translationErrors.remove(identity);
    _translationStatuses[identity] = 'translating';
    notifyListeners();

    try {
      final result = await _chatService.translateMessage(
        bookingId,
        messageId: messageIdOf(message),
        firebaseMessageId: messageFirebaseKey(message),
        sourceLanguage: sourceLanguage,
        targetLanguage: targetLanguage,
      );

      if (result['success'] != true) {
        final error = result['error']?.toString().trim();
        _translationErrors[identity] = (error == null || error.isEmpty)
            ? 'Translation failed'
            : error;
        _translationStatuses[identity] = 'failed';
        return false;
      }

      final data = _asMap(result['data']);
      final apiStatus = data['translation_status']?.toString();
      final translated = data['translated_text']?.toString().trim();
      if (translated != null &&
          translated.isNotEmpty &&
          translated != originalText.trim()) {
        _applyTranslatedText(identity, translated);
        _translationErrors.remove(identity);
        _translationStatuses[identity] =
            (apiStatus == null || apiStatus.isEmpty) ? 'translated' : apiStatus;
        return true;
      }

      if (apiStatus == 'same_language' ||
          apiStatus == 'unchanged' ||
          apiStatus == 'reused' ||
          apiStatus == 'empty' ||
          apiStatus == 'disabled') {
        _translationErrors.remove(identity);
        _translationStatuses[identity] = apiStatus!;
        return apiStatus != 'empty';
      }

      final apiMessage = data['message']?.toString().trim();
      _translationErrors[identity] = (apiMessage == null || apiMessage.isEmpty)
          ? 'Translation failed'
          : apiMessage;
      _translationStatuses[identity] = 'failed';
      return false;
    } catch (_) {
      _translationErrors[identity] = 'Translation failed';
      _translationStatuses[identity] = 'failed';
      return false;
    } finally {
      _translationInFlight.remove(identity);
      notifyListeners();
    }
  }

  // ---------------------------------------------------------------------------
  // Language
  // ---------------------------------------------------------------------------

  Future<bool> setLanguage(int bookingId, String language) async {
    try {
      final result = await _chatService.setLanguage(bookingId, language);
      if (result['success'] == true) {
        if (result['data'] != null) {
          final updated = _asMap(result['data']);
          _session = _session == null
              ? updated
              : _mergeChatSessions(_session!, updated);
          notifyListeners();
        }
        return true;
      }
      return false;
    } catch (_) {
      return false;
    }
  }

  // ---------------------------------------------------------------------------
  // Supported languages
  // ---------------------------------------------------------------------------

  Future<void> loadSupportedLanguages() async {
    try {
      final result = await _chatService.getSupportedLanguages();
      if (result['success'] == true) {
        final data = _asMap(result['data']);
        final langs = data['languages'] as Map? ?? {};
        _supportedLanguages = langs.map(
          (k, v) => MapEntry(k.toString(), v.toString()),
        );
        notifyListeners();
      }
    } catch (_) {
      // Non-fatal — the picker simply won't show options.
    }
  }

  // ---------------------------------------------------------------------------
  // Firebase RTDB real-time listener
  // ---------------------------------------------------------------------------

  /// Attaches live listeners to [firebasePath] (e.g.
  /// `chats/SAM001/booking_1/messages`).
  ///
  /// **Idempotent** — if already listening to this exact path, this is a no-op.
  /// The listener is intentionally kept alive across screen dispose/remount
  /// so that messages sent while the chat screen is closed are not missed.
  ///
  /// • [childAdded]   → new messages arrive without polling.
  /// • [childChanged] → translation patches update [translated_text] in-place.
  ///
  /// [startAfterTimestamp] — millisecond-epoch timestamp (from
  /// [lastRestTimestamp]) used to tell Firebase to only deliver children with
  /// `timestamp > startAfterTimestamp`.  Eliminates duplicate delivery of the
  /// 79+ messages already loaded from REST on every fresh subscription.
  /// Pass 0 (default) to receive all children (used when there are no REST
  /// messages yet).
  ///
  /// Call this AFTER [loadMessages] so [_knownKeys] is populated and
  /// existing messages are not duplicated.
  void listenToFirebase(String firebasePath, {int startAfterTimestamp = 0}) {
    if (!_listenerHadError &&
        _currentFirebasePath == firebasePath &&
        _childAddedSub != null &&
        _childChangedSub != null) {
      return;
    }

    cancelFirebaseListener();
    _currentFirebasePath = firebasePath;
    _listenerHadError = false;

    Query query;
    try {
      final ref = FirebaseDatabase.instance
          .ref(firebasePath)
          .orderByChild('timestamp');
      query = startAfterTimestamp > 0
          ? ref.startAfter(startAfterTimestamp)
          : ref;
    } catch (e) {
      debugPrint('ChatProvider: Firebase ref error: $e');
      return;
    }

    _childAddedSub = query.onChildAdded.listen(
      (event) {
        final key = event.snapshot.key;
        if (key == null) return;
        final msg = _firebaseSnapshotToMessage(key, event.snapshot.value);
        if (msg == null) return;
        _addIfNew(msg);
      },
      onError: (e) {
        debugPrint('ChatProvider: childAdded error: $e');
        _listenerHadError = true;
      },
    );

    _childChangedSub = query.onChildChanged.listen(
      (event) {
        final key = event.snapshot.key;
        if (key == null) return;

        final updated = _firebaseSnapshotToMessage(key, event.snapshot.value);
        if (updated == null) return;

        final updatedKey = messageFirebaseKey(updated);
        final updatedId = messageIdOf(updated);
        final indices = <int>[];
        for (var i = 0; i < _messages.length; i++) {
          final existingKey = messageFirebaseKey(_messages[i]);
          final existingId = messageIdOf(_messages[i]);
          final keyMatch = updatedKey != null && existingKey == updatedKey;
          final idMatch = updatedId != null && existingId == updatedId;
          if (keyMatch || idMatch) indices.add(i);
        }
        if (indices.isEmpty) return;

        final translatedText = updated['translated_text'];
        if (translatedText != null) {
          for (final idx in indices) {
            _messages[idx] = {
              ..._messages[idx],
              'translated_text': translatedText,
            };
          }
        }
        _sortMessages();
        notifyListeners();
      },
      onError: (e) {
        debugPrint('ChatProvider: childChanged error: $e');
        _listenerHadError = true;
      },
    );
  }

  void cancelFirebaseListener() {
    _childAddedSub?.cancel();
    _childAddedSub = null;
    _childChangedSub?.cancel();
    _childChangedSub = null;
    _currentFirebasePath = null;
    _listenerHadError = false;
  }

  // ---------------------------------------------------------------------------
  // Reset
  // ---------------------------------------------------------------------------

  /// Clears all chat state and cancels the Firebase listener.
  ///
  /// Call only when the driver switches to a different booking or logs out.
  /// Do NOT call on ordinary screen disposal — the listener should stay alive
  /// so messages are received even when the chat screen is not visible.
  void clearChat() {
    cancelFirebaseListener();
    _openGeneration++;
    _openSessionFuture = null;
    _openingBookingId = null;
    _session = null;
    _messages = [];
    _error = null;
    _isLoading = false;
    _isSending = false;
    _knownKeys.clear();
    _knownIds.clear();
    _translationErrors.clear();
    _translationStatuses.clear();
    _translationInFlight.clear();
    _lastRestTimestamp = 0;
    _currentBookingId = null;
    notifyListeners();
  }

  @override
  void dispose() {
    _openGeneration++;
    cancelFirebaseListener();
    super.dispose();
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  void _setLoading(bool value) {
    _isLoading = value;
    notifyListeners();
  }

  bool _addIfNew(Map<String, dynamic> msg) {
    final duplicate = _hasSeenMessage(msg);
    _markMessageSeen(msg);

    final warningText = _warningText;
    if (isSafetyWarningMessage(msg, warningText)) {
      final canonical = _canonicalWarning(warningText);
      if (canonical != null) _linkWarningIdentity(msg, canonical);
    }

    if (duplicate) return false;
    if (shouldSkipSafetyWarning(_messages, msg, warningText)) return false;

    _messages.add(msg);
    _sortMessages();
    notifyListeners();
    return true;
  }

  Map<String, dynamic>? _canonicalWarning(String? warningText) {
    for (final msg in _messages) {
      if (isSafetyWarningMessage(msg, warningText)) return msg;
    }
    return null;
  }

  void _linkWarningIdentity(
    Map<String, dynamic> duplicate,
    Map<String, dynamic> canonical,
  ) {
    final duplicateKey = messageFirebaseKey(duplicate);
    final canonicalKey = messageFirebaseKey(canonical);
    if (duplicateKey != null &&
        (canonicalKey == null || canonicalKey.isEmpty)) {
      canonical['firebase_message_id'] = duplicateKey;
    }

    final duplicateId = messageIdOf(duplicate);
    if (duplicateId != null && messageIdOf(canonical) == null) {
      canonical['id'] = duplicateId;
    }
  }

  bool _hasSeenMessage(Map<String, dynamic> msg) {
    final key = messageFirebaseKey(msg);
    final id = messageIdOf(msg);
    return (key != null && _knownKeys.contains(key)) ||
        (id != null && _knownIds.contains(id));
  }

  void _markMessageSeen(Map<String, dynamic> msg) {
    final key = messageFirebaseKey(msg);
    final id = messageIdOf(msg);
    if (key != null) _knownKeys.add(key);
    if (id != null) _knownIds.add(id);
  }

  void _applyTranslatedText(String identity, String translatedText) {
    for (var i = 0; i < _messages.length; i++) {
      if (chatTranslationIdentity(_messages[i]) == identity) {
        _messages[i] = {..._messages[i], 'translated_text': translatedText};
      }
    }
  }

  void _sortMessages() {
    _messages = sortChatMessages(_messages, _warningText);
  }

  Map<String, dynamic>? _firebaseSnapshotToMessage(String key, Object? value) {
    if (value is! Map) return null;
    final data = Map<String, dynamic>.from(value);

    final parsed =
        parseChatUtcDateTime(data['timestamp']) ??
        parseChatUtcDateTime(data['created_at']);

    return {
      'firebase_message_id': key,
      'sender_type': (data['sender_type'] as String?) ?? 'system',
      'sender_id': data['sender_id'],
      'original_text': (data['original_text'] as String?) ?? '',
      'original_language': data['original_language'] as String?,
      'translated_text': data['translated_text'] as String?,
      'is_system_message': data['is_system'] == true,
      'created_at': parsed?.toIso8601String(),
      '_ts': parsed?.millisecondsSinceEpoch ?? 0,
      'id': null,
    };
  }

  static Map<String, dynamic> _normalizeMsg(Map<String, dynamic> raw) {
    final parsed =
        parseChatUtcDateTime(raw['timestamp']) ??
        parseChatUtcDateTime(raw['created_at']) ??
        parseChatUtcDateTime(raw['_ts']);

    return {
      ...raw,
      '_ts': parsed?.millisecondsSinceEpoch ?? 0,
      'created_at': parsed?.toIso8601String(),
    };
  }

  static Map<String, dynamic> _mergeChatSessions(
    Map<String, dynamic> opened,
    Map<String, dynamic> incoming,
  ) {
    final merged = Map<String, dynamic>.from(opened);
    incoming.forEach((key, value) {
      if (!_isBlankChatValue(value)) merged[key] = value;
    });
    return merged;
  }

  static Map<String, dynamic> _asMap(dynamic raw) =>
      raw is Map ? Map<String, dynamic>.from(raw) : <String, dynamic>{};
}
