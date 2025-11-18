// Simple Firebase connection test
const fetch = require('node-fetch').default || require('node-fetch');

const FIREBASE_URL = 'https://ets-1-ccb71-default-rtdb.firebaseio.com';

async function testFirebaseHTTP() {
  console.log('🔥 Testing Firebase HTTP connection...');
  
  const testData = {
    latitude: 12.9716,
    longitude: 77.5946,
    timestamp: new Date().toISOString(),
    accuracy: 10,
    speed: 0,
    heading: 0
  };

  const path = '/drivers/SAM001/1/1.json';
  const url = `${FIREBASE_URL}${path}`;

  try {
    // Test PUT (update)
    console.log(`📡 Updating Firebase at: ${url}`);
    
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testData)
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    console.log('✅ Firebase update successful:', result);

    // Test GET (read back)
    console.log(`📖 Reading from Firebase...`);
    const getResponse = await fetch(url);
    
    if (!getResponse.ok) {
      throw new Error(`HTTP error! status: ${getResponse.status}`);
    }
    
    const data = await getResponse.json();
    console.log('📋 Firebase read result:', data);
    
    if (data && data.latitude === testData.latitude) {
      console.log('🎉 Firebase connection test PASSED!');
    } else {
      console.log('⚠️ Data mismatch - check Firebase rules');
    }

  } catch (error) {
    console.error('❌ Firebase test failed:', error.message);
    
    // Check if it's a network issue
    if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      console.log('🌐 Network connectivity issue detected');
    }
  }
}

// Check if fetch is available
if (typeof fetch === 'undefined') {
  console.log('📦 Installing node-fetch...');
  try {
    require('child_process').execSync('npm install node-fetch@2', { stdio: 'inherit' });
    console.log('✅ node-fetch installed, please run the script again');
  } catch (e) {
    console.log('❌ Failed to install node-fetch. Please run: npm install node-fetch@2');
  }
} else {
  testFirebaseHTTP();
}