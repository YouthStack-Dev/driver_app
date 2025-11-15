import * as React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import LoginScreen from '../screens/LoginScreen';
import HomeScreen from '../screens/HomeScreen';
import RidesScreen from '../screens/RidesScreen';
import SelectAccountScreen from '../screens/SelectAccountScreen';
import CreateBookingScreen from '../screens/CreateBookingScreen';
import SelectShiftScreen from '../screens/SelectShiftScreen';
import BookingSuccessScreen from '../screens/BookingSuccessScreen';
import BookingDetailsScreen from '../screens/BookingDetailsScreen';
import RideDetailsScreen from '../screens/RideDetailsScreen';
import MapsScreen from '../screens/MapsScreen';
import NavigationService from './NavigationService';
import sessionService from '../services/sessionService';

const Stack = createStackNavigator();

export default function AppNavigator() {
  React.useEffect(() => {
    // initialize session checks (schedules expiry handling if a token exists)
    sessionService.init();
  }, []);

  return (
    <NavigationContainer ref={NavigationService.navigationRef}>
      <Stack.Navigator initialRouteName="Login">
        <Stack.Screen 
          name="Login" 
          component={LoginScreen} 
          options={{ headerShown: false }}
        />
        <Stack.Screen 
          name="Rides" 
          component={RidesScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen 
          name="SelectAccount"
          component={SelectAccountScreen}
          options={{ title: 'Select Account' }}
        />
        <Stack.Screen 
          name="RideDetails" 
          component={RideDetailsScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen 
          name="Maps" 
          component={MapsScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen 
          name="CreateBooking" 
          component={CreateBookingScreen}
          options={{ 
            title: 'New Booking',
            headerStyle: { backgroundColor: '#6C63FF' },
            headerTintColor: '#fff',
            headerTitleStyle: { fontWeight: 'bold' },
          }}
        />
        <Stack.Screen 
          name="SelectShift" 
          component={SelectShiftScreen}
          options={{ 
            title: 'Select Shift',
            headerStyle: { backgroundColor: '#6C63FF' },
            headerTintColor: '#fff',
            headerTitleStyle: { fontWeight: 'bold' },
          }}
        />
        <Stack.Screen 
          name="BookingSuccess" 
          component={BookingSuccessScreen}
          options={{ 
            headerShown: false,
          }}
        />
        <Stack.Screen 
          name="BookingDetails" 
          component={BookingDetailsScreen}
          options={{ 
            title: 'Booking Details',
            headerStyle: { backgroundColor: '#6C63FF' },
            headerTintColor: '#fff',
            headerTitleStyle: { fontWeight: 'bold' },
          }}
        />
        <Stack.Screen name="Home" component={HomeScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}