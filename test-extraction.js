// Test script to verify ID extraction logic
const testData = {
  "access_token": "sample_token",
  "refresh_token": "sample_refresh", 
  "token_type": "bearer",
  "user": {
    "driver": {
      "vendor_id": 1,
      "name": "John Doeq", 
      "driver_id": 1
    },
    "tenant": {
      "tenant_id": "SAM001",
      "name": "Sample Tenant"
    }
  },
  "accounts": [
    {
      "driver_id": 1,
      "vendor_id": 1,
      "tenant_id": "SAM001"
    }
  ]
};

// Test extraction logic
const userData = testData;

const driverId = userData.driver_id || 
                (userData.user && userData.user.driver && userData.user.driver.driver_id) || 
                (userData.user && userData.user.driver_id) || 
                (userData.driver && userData.driver.driver_id) ||
                userData.id;
                
const vendorId = userData.vendor_id || 
                (userData.account && userData.account.vendor_id) || 
                (userData.user && userData.user.driver && userData.user.driver.vendor_id) ||
                (userData.vendor && userData.vendor.id);
                
const tenantId = userData.tenant_id || 
                (userData.account && userData.account.tenant_id) || 
                (userData.user && userData.user.tenant_id) || 
                (userData.user && userData.user.driver && userData.user.driver.tenant_id) ||
                (userData.user && userData.user.tenant && userData.user.tenant.tenant_id) ||
                (userData.tenant && userData.tenant.id);

console.log('Test Results:');
console.log('Driver ID:', driverId); // Should be 1
console.log('Vendor ID:', vendorId); // Should be 1  
console.log('Tenant ID:', tenantId); // Should be "SAM001"

// Direct path test
console.log('Direct path test:');
console.log('userData.user.tenant.tenant_id:', userData.user.tenant.tenant_id);