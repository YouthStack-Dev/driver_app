const httpFirebaseService = require('./services/httpFirebaseService');

async function testFirebaseConnection() {
  console.log('🔥 Testing Firebase HTTP connection...');
  
  const testData = {
    latitude: 12.9716,
    longitude: 77.5946,
    timestamp: new Date().toISOString(),
    accuracy: 10,
    speed: 0,
    heading: 0
  };

  try {
    // Test update
    const result = await httpFirebaseService.updateDriverLocation(
      'SAM001', // tenantId
      '1',      // vendorId  
      '1',      // driverId
      testData
    );
    
    console.log('✅ Firebase update result:', result);
    
    // Test read back
    const readResult = await httpFirebaseService.getDriverLocation(
      'SAM001',
      '1', 
      '1'
    );
    
    console.log('📖 Firebase read result:', readResult);
    
  } catch (error) {
    console.error('❌ Firebase test failed:', error);
  }
}

testFirebaseConnection();