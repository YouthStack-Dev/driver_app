import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import 'rides_screen.dart';
import 'trip_history_screen.dart';
import 'profile_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen>
    with SingleTickerProviderStateMixin {
  int _currentIndex = 0;

  // Keep pages alive when switching tabs
  final List<Widget> _pages = const [
    RidesScreen(embeddedMode: true),
    TripHistoryScreen(embeddedMode: true),
    ProfileScreen(embeddedMode: true),
  ];

  late final PageController _pageController;

  static const _tabs = [
    _TabItem(label: 'Bookings',     icon: Icons.directions_car_rounded),
    _TabItem(label: 'Trip History', icon: Icons.history_rounded),
    _TabItem(label: 'Profile',      icon: Icons.person_outline_rounded),
  ];

  @override
  void initState() {
    super.initState();
    _pageController = PageController(initialPage: _currentIndex);
  }

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  void _onTabTapped(int index) {
    if (index == _currentIndex) return;
    setState(() => _currentIndex = index);
    _pageController.jumpToPage(index);
  }

  @override
  Widget build(BuildContext context) {
    SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(
      statusBarColor: Colors.white,
      statusBarIconBrightness: Brightness.dark,
    ));

    return Scaffold(
      backgroundColor: const Color(0xFFF4F6FA),
      body: Column(
        children: [
          // ── Top pill tab bar ──────────────────────────────────────────────
          _PillTabBar(
            tabs: _tabs,
            selectedIndex: _currentIndex,
            onTap: _onTabTapped,
          ),

          // ── Page content ─────────────────────────────────────────────────
          Expanded(
            child: PageView(
              controller: _pageController,
              physics: const NeverScrollableScrollPhysics(),
              children: _pages,
            ),
          ),
        ],
      ),
    );
  }
}

// ─── Data model ──────────────────────────────────────────────────────────────

class _TabItem {
  final String label;
  final IconData icon;
  const _TabItem({required this.label, required this.icon});
}

// ─── Pill Tab Bar Widget ─────────────────────────────────────────────────────

class _PillTabBar extends StatelessWidget {
  final List<_TabItem> tabs;
  final int selectedIndex;
  final ValueChanged<int> onTap;

  const _PillTabBar({
    required this.tabs,
    required this.selectedIndex,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final topPadding = MediaQuery.of(context).padding.top;
    final auth = Provider.of<AuthProvider>(context);
    final driverName = auth.driver?['name'] ?? 'Driver';

    return Container(
      color: Colors.white,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Status bar spacer
          SizedBox(height: topPadding),

          // ── Header row: greeting+name LEFT, company dropdown RIGHT ────────
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 12, 16, 0),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                // Left: greeting + name
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        _greeting(),
                        style: GoogleFonts.poppins(
                          fontSize: 11,
                          fontWeight: FontWeight.w500,
                          color: const Color(0xFF6B7280),
                        ),
                      ),
                      Text(
                        driverName,
                        style: GoogleFonts.poppins(
                          fontSize: 15,
                          fontWeight: FontWeight.bold,
                          color: const Color(0xFF111827),
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                ),

                // Right: company dropdown
                _CompanyDropdown(auth: auth),
              ],
            ),
          ),

          const SizedBox(height: 12),

          // ── Pill switcher ─────────────────────────────────────────────────
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 14),
            child: Container(
              height: 44,
              decoration: BoxDecoration(
                color: const Color(0xFFEEF1F8),
                borderRadius: BorderRadius.circular(30),
              ),
              child: Row(
                children: List.generate(tabs.length, (i) {
                  final selected = i == selectedIndex;
                  return Expanded(
                    child: GestureDetector(
                      behavior: HitTestBehavior.opaque,
                      onTap: () => onTap(i),
                      child: AnimatedContainer(
                        duration: const Duration(milliseconds: 220),
                        curve: Curves.easeInOut,
                        margin: const EdgeInsets.all(4),
                        alignment: Alignment.center,
                        decoration: BoxDecoration(
                          color: selected
                              ? const Color(0xFF1E6BFF)
                              : Colors.transparent,
                          borderRadius: BorderRadius.circular(26),
                          boxShadow: selected
                              ? [
                                  BoxShadow(
                                    color: const Color(0xFF1E6BFF)
                                        .withValues(alpha: 0.28),
                                    blurRadius: 10,
                                    offset: const Offset(0, 3),
                                  )
                                ]
                              : [],
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(
                              tabs[i].icon,
                              size: 14,
                              color: selected
                                  ? Colors.white
                                  : const Color(0xFF6B7280),
                            ),
                            const SizedBox(width: 5),
                            Text(
                              tabs[i].label,
                              style: GoogleFonts.poppins(
                                fontSize: 11.5,
                                fontWeight: selected
                                    ? FontWeight.bold
                                    : FontWeight.w500,
                                color: selected
                                    ? Colors.white
                                    : const Color(0xFF6B7280),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  );
                }),
              ),
            ),
          ),

          // Bottom divider
          Container(height: 1, color: const Color(0xFFE8ECF4)),
        ],
      ),
    );
  }

  String _greeting() {
    final h = DateTime.now().hour;
    if (h < 12) return 'Good Morning 👋';
    if (h < 17) return 'Good Afternoon 👋';
    return 'Good Evening 👋';
  }
}

// ─── Logout Button ────────────────────────────────────────────────────────────

class _LogoutButton extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final auth = Provider.of<AuthProvider>(context, listen: false);
    return GestureDetector(
      onTap: () async {
        final confirmed = await showDialog<bool>(
          context: context,
          builder: (_) => AlertDialog(
            shape:
                RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
            title: Text('Log Out',
                style: GoogleFonts.poppins(fontWeight: FontWeight.bold)),
            content: Text('Are you sure you want to log out?',
                style: GoogleFonts.poppins(fontSize: 13.5)),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(context, false),
                child: Text('Cancel',
                    style: GoogleFonts.poppins(color: const Color(0xFF6B7280))),
              ),
              TextButton(
                onPressed: () => Navigator.pop(context, true),
                child: Text('Log Out',
                    style: GoogleFonts.poppins(
                        color: Colors.red, fontWeight: FontWeight.bold)),
              ),
            ],
          ),
        );
        if (confirmed == true && context.mounted) {
          await auth.logout();
          if (context.mounted) {
            Navigator.pushNamedAndRemoveUntil(
                context, '/login', (route) => false);
          }
        }
      },
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: BoxDecoration(
          color: const Color(0xFFFEF2F2),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
              color: const Color(0xFFDC2626).withValues(alpha: 0.2), width: 1),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.logout_rounded,
                color: Color(0xFFDC2626), size: 14),
            const SizedBox(width: 5),
            Text(
              'Logout',
              style: GoogleFonts.poppins(
                color: const Color(0xFFDC2626),
                fontSize: 11,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Company Dropdown ─────────────────────────────────────────────────────────
class _CompanyDropdown extends StatelessWidget {
  final AuthProvider auth;
  const _CompanyDropdown({required this.auth});

  String get _currentCompany {
    final user = auth.currentUser;
    return user?['tenant']?['name'] ??
        user?['tenant_name'] ??
        user?['user']?['tenant']?['name'] ??
        auth.driver?['tenant_name'] ??
        'Company';
  }

  @override
  Widget build(BuildContext context) {
    final accounts = auth.accounts;
    final hasMultiple = accounts.length > 1;

    return GestureDetector(
      onTap: hasMultiple ? () => _showDropdown(context, accounts) : null,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
        decoration: BoxDecoration(
          color: const Color(0xFFF0F6FF),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
              color: const Color(0xFF1E6BFF).withValues(alpha: 0.25), width: 1),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.business_rounded,
                color: Color(0xFF1E6BFF), size: 14),
            const SizedBox(width: 5),
            ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 110),
              child: Text(
                _currentCompany,
                style: GoogleFonts.poppins(
                  color: const Color(0xFF1E6BFF),
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ),
            // Arrow only shown when there are multiple companies
            if (hasMultiple) ...[
              const SizedBox(width: 3),
              const Icon(Icons.keyboard_arrow_down_rounded,
                  color: Color(0xFF1E6BFF), size: 15),
            ],
          ],
        ),
      ),
    );
  }


  void _showDropdown(BuildContext context, List<dynamic> accounts) {
    if (accounts.isEmpty) return;
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (_) => Container(
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        ),
        padding: const EdgeInsets.fromLTRB(20, 16, 20, 32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(
                width: 36,
                height: 4,
                decoration: BoxDecoration(
                  color: const Color(0xFFE5E7EB),
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const SizedBox(height: 16),
            Text(
              'Switch Company',
              style: GoogleFonts.poppins(
                fontSize: 15,
                fontWeight: FontWeight.bold,
                color: const Color(0xFF111827),
              ),
            ),
            const SizedBox(height: 12),
            ...accounts.map((acc) {
              final name = acc['vendor_name'] ??
                  acc['tenant_name'] ??
                  acc['name'] ??
                  'Unknown';
              final tenantId = acc['tenant_id'] ?? '';
              final isCurrent = tenantId == auth.tenantId;
              return ListTile(
                contentPadding: const EdgeInsets.symmetric(horizontal: 4),
                leading: Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: isCurrent
                        ? const Color(0xFFEEF5FF)
                        : const Color(0xFFF3F4F6),
                    shape: BoxShape.circle,
                  ),
                  child: Icon(
                    Icons.business_rounded,
                    size: 18,
                    color: isCurrent
                        ? const Color(0xFF1E6BFF)
                        : const Color(0xFF6B7280),
                  ),
                ),
                title: Text(
                  name,
                  style: GoogleFonts.poppins(
                    fontWeight:
                        isCurrent ? FontWeight.bold : FontWeight.w500,
                    fontSize: 13.5,
                    color: isCurrent
                        ? const Color(0xFF1E6BFF)
                        : const Color(0xFF111827),
                  ),
                ),
                trailing: isCurrent
                    ? const Icon(Icons.check_circle_rounded,
                        color: Color(0xFF1E6BFF), size: 18)
                    : null,
                onTap: isCurrent
                    ? null
                    : () {
                        Navigator.pop(context);
                        auth.switchCompany(acc);
                      },
              );
            }),
          ],
        ),
      ),
    );
  }
}
