# My App Project - Employee Cab Booking App

A React Native app built with Expo for employee cab booking and schedule management.

## Features

- 🔐 Employee login with JWT authentication
- 📅 View and manage cab bookings
- 🚗 Create new bookings (single dates or date ranges)
- ⏰ Select shifts (morning pickup/evening drop)
- 🔄 Real-time booking status tracking
- ✕ Cancel pending bookings
- 📱 Fully responsive mobile interface

## Prerequisites

- Node.js (>= 18.x)
- npm or yarn
- Android Studio (for building APK)
- Android SDK
- Java Development Kit (JDK) 17 or higher

## Installation

1. **Clone/Navigate to the repository**
   ```bash
   cd /Users/madhuv/Library/CloudStorage/OneDrive-Deloitte(O365D)/Projects/New\ projects/app/my-app-project
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment**
   - Update API configuration in `constants/config.js` if needed
   - Default API: `https://api.gocab.tech`

## Running the App

### Development Mode

```bash
# Start Expo development server
npx expo start

# Run on Android device/emulator
npx expo start --android

# Run on iOS simulator (Mac only)
npx expo start --ios

# Run in web browser
npx expo start --web
```

## Building APK (Native Build)

### Prerequisites for Building

1. **Install Android Studio**
   - Download from: https://developer.android.com/studio
   - Install Android SDK (API level 34 or latest)
   - Set up environment variables:
     ```bash
     export ANDROID_HOME=$HOME/Library/Android/sdk
     export PATH=$PATH:$ANDROID_HOME/emulator
     export PATH=$PATH:$ANDROID_HOME/platform-tools
     ```

2. **Install JDK**
   ```bash
   # On macOS (using Homebrew)
   brew install openjdk@17
   
   # Add to your shell profile (~/.zshrc or ~/.bash_profile)
   export JAVA_HOME=$(/usr/libexec/java_home -v 17)
   ```

### Build Steps

#### 1. Generate Native Android Project

```bash
npx expo prebuild --clean
```

This will create the `android` folder with native code.

#### 2. Build the APK

```bash
cd android
./gradlew assembleDebug
```

For production/release build:
```bash
./gradlew assembleRelease
```

#### 3. Bundle JavaScript Code (Optional - usually done automatically)

If you need to manually bundle the JavaScript:

```bash
# Navigate back to project root
cd ..

# Create assets directory if it doesn't exist
mkdir -p android/app/src/main/assets

# Bundle the JavaScript and assets
npx react-native bundle \
  --platform android \
  --dev false \
  --entry-file index.js \
  --bundle-output android/app/src/main/assets/index.android.bundle \
  --assets-dest android/app/src/main/res
```

#### 4. Locate and Install the APK

**Debug APK Location:**
```
android/app/build/outputs/apk/debug/app-debug.apk
```

**Release APK Location:**
```
android/app/build/outputs/apk/release/app-release.apk
```

**Install on Connected Device:**
```bash
# Using ADB
adb install android/app/build/outputs/apk/debug/app-debug.apk

# Or drag and drop the APK to your device/emulator
```

### Quick Build Script

For convenience, you can run all steps in sequence:

```bash
# Clean build (from project root)
npx expo prebuild --clean && \
cd android && \
./gradlew clean assembleDebug && \
cd .. && \
echo "✓ APK built successfully!" && \
echo "Location: android/app/build/outputs/apk/debug/app-debug.apk"
```

## Troubleshooting Build Issues

### Common Issues

1. **"SDK location not found"**
   ```bash
   # Create local.properties in android folder
   echo "sdk.dir=$ANDROID_HOME" > android/local.properties
   ```

2. **Gradle build fails**
   ```bash
   # Clean Gradle cache
   cd android
   ./gradlew clean
   
   # Or delete build folders
   rm -rf android/app/build
   rm -rf android/build
   ```

3. **"index.android.bundle not found"**
   ```bash
   # Create assets directory
   mkdir -p android/app/src/main/assets
   
   # Run the bundle command (step 3 above)
   ```

4. **Metro bundler issues**
   ```bash
   # Clear Metro cache
   npx expo start --clear
   
   # Or manually
   rm -rf node_modules/.cache
   ```

5. **Old native code after changes**
   ```bash
   # Re-run prebuild
   npx expo prebuild --clean
   ```

## Project Structure

```
my-app-project/
├── screens/              # App screens
│   ├── LoginScreen.js
│   ├── SchedulesScreen.js
│   ├── CreateBookingScreen.js
│   ├── SelectShiftScreen.js
│   ├── BookingDetailsScreen.js
│   └── BookingSuccessScreen.js
├── services/             # API service layer
│   ├── authService.js
│   ├── bookingService.js
│   ├── shiftService.js
│   └── weekoffService.js
├── constants/            # App configuration
│   └── config.js
├── components/           # Reusable components
│   └── Toast.js
├── navigation/           # Navigation setup
│   └── AppNavigator.js
├── android/             # Generated native Android code
├── App.js               # Root component
├── app.json             # Expo configuration
└── package.json         # Dependencies
```

## API Endpoints

Base URL: `https://api.gocab.tech`

- `POST /api/v1/auth/employee/login` - Employee login
- `GET /api/v1/bookings/employee` - Get employee bookings
- `POST /api/v1/bookings/` - Create booking
- `PATCH /api/v1/bookings/cancel/{id}` - Cancel booking
- `GET /api/v1/bookings/{id}` - Get booking details
- `GET /api/v1/weekoff-configs/{employee_id}` - Get weekoff config
- `GET /api/v1/shifts/` - Get active shifts

## Configuration

### Update API URL

Edit `constants/config.js`:
```javascript
export const BASE_URL = 'https://your-api-url.com';
```

### Update App Identifiers

Edit `app.json`:
```json
{
  "expo": {
    "android": {
      "package": "com.yourcompany.yourapp"
    },
    "ios": {
      "bundleIdentifier": "com.yourcompany.yourapp"
    }
  }
}
```

After changing identifiers, run:
```bash
npx expo prebuild --clean
```

## Development Tips

- Use `console.log` statements for debugging (check Metro terminal)
- Test on real device for best experience
- Use Expo Go app for quick testing during development
- Build native APK for production testing
- Clear cache if you encounter strange issues: `npx expo start --clear`

## Clean Build

To start fresh:

```bash
# Remove node_modules and generated files
rm -rf node_modules
rm -rf android
rm -rf ios
rm -rf .expo

# Reinstall dependencies
npm install

# Generate native code
npx expo prebuild --clean

# Build APK
cd android && ./gradlew assembleDebug
```

## License

Private project - All rights reserved

## Support

For issues or questions, contact the development team.



1. npx expo prebuild
1. cd android
2. ./gradlew assembleDebug
3. npx react-native bundle --platform android \                     
  --dev false \
  --entry-file index.js \
  --bundle-output android/app/src/main/assets/index.android.bundle \
  --assets-dest android/app/src/main/res

4. find apk and install it