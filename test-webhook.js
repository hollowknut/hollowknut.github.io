// test-webhook.js
// This script simulates a TTN webhook payload to test our server implementation

const axios = require('axios');

// Sample TTN v3 webhook payload based on the data.json format
const samplePayload = {
  "end_device_ids": {
    "device_id": "wio-e5-du",
    "application_ids": {
      "application_id": "agriculturalmsyst-du"
    },
    "dev_eui": "2CF7F12060206BE1",
    "join_eui": "526973696E674846",
    "dev_addr": "27FC1FF5"
  },
  "correlation_ids": [
    "gs:uplink:01JQTYPAHXSZ96BA4PXEKC5GTH"
  ],
  "received_at": "2025-04-02T10:04:40.786285821Z",
  "uplink_message": {
    "session_key_id": "AZXiKeuz5glsAh8cy2njHw==",
    "f_port": 8,
    "f_cnt": 5420,
    "frm_payload": "B/sa7wAAJw==",
    "decoded_payload": {
      "humidity": "68.95 %",
      "light": "0 lm",
      "moisture": "39 %",
      "temperature": "68.77 °F"
    }
  }
};

// Function to send test webhook
async function sendTestWebhook() {
  try {
    console.log('Sending test webhook payload to local server...');
    
    const response = await axios.post('http://localhost:3000/webhooks', samplePayload, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('Response status:', response.status);
    console.log('Response data:', response.data);
    console.log('Test webhook sent successfully!');
  } catch (error) {
    console.error('Error sending test webhook:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

// Execute the test
sendTestWebhook();
