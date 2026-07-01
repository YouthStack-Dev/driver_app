import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:google_fonts/google_fonts.dart';
import '../providers/auth_provider.dart';
import '../services/driver_config_service.dart';

class ProfileScreen extends StatelessWidget {
  final bool embeddedMode;
  const ProfileScreen({super.key, this.embeddedMode = false});

  @override
  Widget build(BuildContext context) {
    final auth = Provider.of<AuthProvider>(context);
    final user = auth.currentUser;
    final userData = user ?? {};
    final driver = userData['driver'] ?? userData['user']?['driver'] ?? {};
    final tenant = userData['tenant'] ?? userData['user']?['tenant'] ?? {};
    
    return Scaffold(
      backgroundColor: const Color(0xFFF4F6FA),
      appBar: embeddedMode ? null : AppBar(
        title: Text(
          'My Profile', 
          style: GoogleFonts.poppins(fontWeight: FontWeight.bold, color: const Color(0xFF111827))
        ),
        elevation: 0,
        backgroundColor: const Color(0xFFFFFFFF),
        foregroundColor: const Color(0xFF111827),
        centerTitle: true,
        iconTheme: const IconThemeData(color: Color(0xFF111827)),
      ),
      body: SingleChildScrollView(
        child: Column(
          children: [
            _buildHeader(driver, tenant),
            
            _buildSection(
              context, 
              title: 'Personal Information', 
              icon: Icons.person_outline_rounded,
              children: [
                _buildInfoRow('Email', driver['email']),
                _buildInfoRow('Phone', driver['phone'] ?? driver['mobile_number']),
                _buildInfoRow('Gender', driver['gender']),
                _buildInfoRow('Date of Birth', driver['date_of_birth']),
                _buildInfoRow('Date of Joining', driver['date_of_joining']),
              ],
            ),
            
            _buildSection(
              context, 
              title: 'Address Info', 
              icon: Icons.map_outlined,
              children: [
                _buildInfoRow('Current Address', driver['current_address']),
                _buildInfoRow('Permanent Address', driver['permanent_address']),
              ],
            ),
            
            _buildSection(
              context, 
              title: 'License & Identification', 
              icon: Icons.badge_outlined,
              children: [
                _buildInfoRow('License Number', driver['license_number']),
                _buildInfoRow('License Expiry', driver['license_expiry_date']),
                _buildInfoRow('Badge Number', driver['badge_number']),
                _buildInfoRow('Badge Expiry', driver['badge_expiry_date']),
                _buildInfoRow('Alt ID Type', driver['alt_govt_id_type']),
                _buildInfoRow('Alt ID Number', driver['alt_govt_id_number']),
              ],
            ),
            
            _buildVerificationSection(context, driver),
            
            _buildSection(
              context, 
              title: 'Company Information', 
              icon: Icons.business_outlined,
              children: [
                _buildInfoRow('Company', tenant['name']),
                _buildInfoRow('Tenant ID', tenant['tenant_id']?.toString()),
                _buildInfoRow('Address', tenant['address']),
                _buildInfoRow('Induction Date', driver['induction_date']),
              ],
            ),
            
            _buildSection(
              context, 
              title: 'System Configuration', 
              icon: Icons.settings_system_daydream_outlined,
              children: [
                _buildInfoRow('Speed Limit', '${DriverConfigService().config.speedLimitKmph.toInt()} km/h'),
                _buildInfoRow('Upload Interval', '${DriverConfigService().config.uploadIntervalSeconds}s'),
                _buildInfoRow('Login OTP (Boarding)', DriverConfigService().config.loginBoardingOtp ? 'Yes' : 'No'),
                _buildInfoRow('Login OTP (Deboarding)', DriverConfigService().config.loginDeboardingOtp ? 'Yes' : 'No'),
                _buildInfoRow('Logout OTP (Boarding)', DriverConfigService().config.logoutBoardingOtp ? 'Yes' : 'No'),
                _buildInfoRow('Logout OTP (Deboarding)', DriverConfigService().config.logoutDeboardingOtp ? 'Yes' : 'No'),
                _buildInfoRow('Women Escort Required', DriverConfigService().config.escortRequiredForWomen ? 'Yes (${DriverConfigService().config.escortRequiredStartTime} - ${DriverConfigService().config.escortRequiredEndTime})' : 'No'),
              ],
            ),
            
            const SizedBox(height: 24),
            _buildLogoutButton(context),
            const SizedBox(height: 40),

          ],
        ),
      ),
    );
  }

  Widget _buildLogoutButton(BuildContext context) {
    final auth = Provider.of<AuthProvider>(context, listen: false);
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: GestureDetector(
        onTap: () async {
          final confirmed = await showDialog<bool>(
            context: context,
            builder: (_) => AlertDialog(
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
              backgroundColor: Colors.white,
              title: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: const Color(0xFFFEF2F2),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(Icons.logout_rounded, color: Color(0xFFDC2626), size: 20),
                  ),
                  const SizedBox(width: 12),
                  Text('Log Out',
                      style: GoogleFonts.poppins(
                          fontWeight: FontWeight.bold,
                          fontSize: 17,
                          color: const Color(0xFF111827))),
                ],
              ),
              content: Text(
                'Are you sure you want to log out of the app?',
                style: GoogleFonts.poppins(fontSize: 13.5, color: const Color(0xFF6B7280), height: 1.5),
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.pop(context, false),
                  child: Text('Cancel',
                      style: GoogleFonts.poppins(
                          color: const Color(0xFF6B7280), fontWeight: FontWeight.w600)),
                ),
                TextButton(
                  onPressed: () => Navigator.pop(context, true),
                  child: Text('Log Out',
                      style: GoogleFonts.poppins(
                          color: const Color(0xFFDC2626), fontWeight: FontWeight.bold)),
                ),
              ],
            ),
          );
          if (confirmed == true && context.mounted) {
            await auth.logout();
            if (context.mounted) {
              Navigator.pushNamedAndRemoveUntil(context, '/login', (route) => false);
            }
          }
        },
        child: Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(vertical: 16),
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              colors: [Color(0xFFDC2626), Color(0xFFB91C1C)],
            ),
            borderRadius: BorderRadius.circular(16),
            boxShadow: [
              BoxShadow(
                color: const Color(0xFFDC2626).withValues(alpha: 0.30),
                blurRadius: 14,
                offset: const Offset(0, 6),
              ),
            ],
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.logout_rounded, color: Colors.white, size: 20),
              const SizedBox(width: 10),
              Text(
                'Log Out',
                style: GoogleFonts.poppins(
                  color: Colors.white,
                  fontSize: 15,
                  fontWeight: FontWeight.bold,
                  letterSpacing: 0.3,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildHeader(Map<String, dynamic> driver, Map<String, dynamic> tenant) {
    final name = driver['name'] ?? 'Driver';
    final initial = name.isNotEmpty ? name[0].toUpperCase() : 'D';
    final code = driver['code'] ?? '';
    final tenantName = tenant['name'] ?? '';

    return Container(
      width: double.infinity,
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(bottom: Radius.circular(32)),
        boxShadow: [
          BoxShadow(
            color: Color(0x0C000000),
            blurRadius: 15,
            offset: Offset(0, 8),
          ),
        ],
      ),
      padding: const EdgeInsets.fromLTRB(24, 24, 24, 40),
      child: Column(
        children: [
          // Profile Avatar with Ring glow
          Container(
            padding: const EdgeInsets.all(4),
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: const Color(0xFF2E7CFF).withValues(alpha: 0.2),
            ),
            child: Container(
              padding: const EdgeInsets.all(3),
              decoration: const BoxDecoration(
                shape: BoxShape.circle,
                color: Color(0xFF1E6BFF),
              ),
              child: CircleAvatar(
                radius: 46,
                backgroundColor: const Color(0xFFFFFFFF),
                backgroundImage: driver['photo_url'] != null ? NetworkImage(driver['photo_url']) : null,
                child: driver['photo_url'] == null 
                    ? Text(
                        initial, 
                        style: GoogleFonts.poppins(
                          fontSize: 36, 
                          fontWeight: FontWeight.bold, 
                          color: const Color(0xFF2E7CFF),
                        )
                      ) 
                    : null,
              ),
            ),
          ),
          
          const SizedBox(height: 16),
          
          // Driver Name
          Text(
            name, 
            style: GoogleFonts.poppins(
              fontSize: 21, 
              fontWeight: FontWeight.bold, 
              color: const Color(0xFF111827),
            )
          ),
          
          const SizedBox(height: 8),
          
          // Driver Code Badge
          if (code.isNotEmpty)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
              decoration: BoxDecoration(
                color: const Color(0xFF2E7CFF).withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: const Color(0xFF2E7CFF).withValues(alpha: 0.2)),
              ),
              child: Text(
                code, 
                style: GoogleFonts.poppins(
                  fontSize: 11.5, 
                  fontWeight: FontWeight.bold, 
                  color: const Color(0xFF111827),
                  letterSpacing: 0.5
                )
              ),
            ),
            
          if (tenantName.isNotEmpty) ...[
            const SizedBox(height: 8),
            Text(
              tenantName, 
              style: GoogleFonts.poppins(
                fontSize: 13, 
                color: const Color(0xFF6B7280),
                fontWeight: FontWeight.w500
              )
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildSection(BuildContext context, {required String title, required IconData icon, required List<Widget> children}) {
    return Container(
      margin: const EdgeInsets.fromLTRB(20, 20, 20, 0),
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: const Color(0xFFFFFFFF),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: const Color(0xFFE8ECF4), width: 1),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.1),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, color: const Color(0xFF2E7CFF), size: 20),
              const SizedBox(width: 8),
              Text(
                title, 
                style: GoogleFonts.poppins(
                  fontSize: 15.5, 
                  fontWeight: FontWeight.bold, 
                  color: const Color(0xFF111827)
                )
              ),
            ],
          ),
          const SizedBox(height: 10),
          const Divider(thickness: 1.0, color: Color(0xFFE8ECF4)),
          const SizedBox(height: 6),
          ...children,
        ],
      ),
    );
  }

  Widget _buildInfoRow(String label, String? value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8.0),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            flex: 2, 
            child: Text(
              label, 
              style: GoogleFonts.poppins(fontSize: 13, color: const Color(0xFF6B7280), fontWeight: FontWeight.w500)
            )
          ),
          Expanded(
            flex: 3, 
            child: Text(
              value ?? 'N/A', 
              style: GoogleFonts.poppins(fontSize: 13, fontWeight: FontWeight.w600, color: const Color(0xFF111827)), 
              textAlign: TextAlign.right
            )
          ),
        ],
      ),
    );
  }

  Widget _buildVerificationSection(BuildContext context, Map<String, dynamic> driver) {
    return _buildSection(
      context, 
      title: 'Verification Status', 
      icon: Icons.verified_user_outlined,
      children: [
        _buildDocRow('Background Verification', driver['bg_verify_status'], driver['bg_expiry_date']),
        _buildDocRow('Police Verification', driver['police_verify_status'], driver['police_expiry_date']),
        _buildDocRow('Medical Verification', driver['medical_verify_status'], driver['medical_expiry_date']),
        _buildDocRow('Training Verification', driver['training_verify_status'], driver['training_expiry_date']),
        _buildDocRow('Eye Test', driver['eye_verify_status'], driver['eye_expiry_date']),
      ],
    );
  }

  Widget _buildDocRow(String label, String? status, String? expiry) {
    Color badgeTextColor = Colors.grey;
    Color badgeBgColor = const Color(0xFF2E7CFF);
    IconData statusIcon = Icons.help_outline;

    if (status == 'Approved') {
      badgeTextColor = const Color(0xFF10B981);
      badgeBgColor = const Color(0xFF10B981).withValues(alpha: 0.12);
      statusIcon = Icons.check_circle_outline;
    } else if (status == 'Pending') {
      badgeTextColor = const Color(0xFFF59E0B);
      badgeBgColor = const Color(0xFFF59E0B).withValues(alpha: 0.12);
      statusIcon = Icons.hourglass_empty;
    } else if (status == 'Rejected' || status == 'Expired') {
      badgeTextColor = const Color(0xFFEF4444);
      badgeBgColor = const Color(0xFFEF4444).withValues(alpha: 0.12);
      statusIcon = Icons.error_outline;
    }

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8.0),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Expanded(
            child: Text(
              label, 
              style: GoogleFonts.poppins(fontSize: 13, color: const Color(0xFF6B7280), fontWeight: FontWeight.w500)
            )
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: badgeBgColor,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: badgeTextColor.withValues(alpha: 0.3), width: 0.8),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(statusIcon, color: badgeTextColor, size: 12),
                    const SizedBox(width: 4),
                    Text(
                      status ?? 'N/A', 
                      style: GoogleFonts.poppins(color: badgeTextColor, fontSize: 11, fontWeight: FontWeight.bold)
                    ),
                  ],
                ),
              ),
              if (expiry != null)
                Padding(
                  padding: const EdgeInsets.only(top: 4, right: 2),
                  child: Text('Exp: $expiry', style: GoogleFonts.poppins(fontSize: 10, color: const Color(0xFF8C90A0), fontWeight: FontWeight.w500)),
                ),
            ],
          )
        ],
      ),
    );
  }
}
