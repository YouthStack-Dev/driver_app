// Simple Firebase connection test using built-in Node.js modules
const https = require('https');

const FIREBASE_URL = 'https://ets-1-ccb71-default-rtdb.firebaseio.com';

function makeRequest(url, method = 'GET', data = null) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      }
    };

    const req = https.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        try {
          const parsed = JSON.parse(responseData);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, data: responseData });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

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
    
    const updateResult = await makeRequest(url, 'PUT', testData);
    
    if (updateResult.status === 200) {
      console.log('✅ Firebase update successful:', updateResult.data);
    } else {
      console.log('❌ Firebase update failed:', updateResult.status, updateResult.data);
      return;
    }

    // Test GET (read back)
    console.log(`📖 Reading from Firebase...`);
    const getResult = await makeRequest(url, 'GET');
    
    if (getResult.status === 200) {
      console.log('📋 Firebase read result:', getResult.data);
      
      if (getResult.data && getResult.data.latitude === testData.latitude) {
        console.log('🎉 Firebase connection test PASSED!');
        console.log('✅ Location tracking will work correctly');
      } else {
        console.log('⚠️ Data mismatch - check Firebase rules');
      }
    } else {
      console.log('❌ Firebase read failed:', getResult.status, getResult.data);
    }

  } catch (error) {
    console.error('❌ Firebase test failed:', error.message);
    
    // Check if it's a network issue
    if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      console.log('🌐 Network connectivity issue detected');
    } else if (error.code === 'ECONNRESET') {
      console.log('🔒 Connection reset - might be a firewall or proxy issue');
    }
  }
}

testFirebaseHTTP();