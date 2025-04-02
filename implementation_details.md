# Agricultural Monitoring System - Implementation Details

## Overview
This document provides details about the implementation of the Agricultural Monitoring System that integrates with The Things Stack V3 API and Losant.

## Key Components

### 1. TTN V3 API Integration
The application receives data from The Things Stack V3 API through a webhook endpoint. The webhook endpoint (`/webhooks`) processes incoming data from TTN and forwards it to Losant.

### 2. Losant Integration
Data received from TTN is forwarded to a Losant webhook for further processing and visualization. The Losant webhook URL and access key are configured in the server.js file.

### 3. Data Processing
The application processes both raw and pre-decoded payloads from TTN. For raw payloads, it uses a decoder function to extract temperature, humidity, light, and moisture data. For pre-decoded payloads, it uses the values directly.

### 4. Data Storage
Historical data is stored in a data.json file, which is loaded on startup and saved on shutdown. This allows the application to maintain historical data across restarts.

### 5. Real-time Updates
The application uses Socket.IO to provide real-time updates to connected clients. When new data is received, it is emitted to all connected clients.

## Implementation Details

### Server.js Changes
1. Added Losant configuration:
   ```javascript
   // Losant Configuration
   const LOSANT_WEBHOOK_URL = 'https://triggers.losant.com/webhooks/yLCyBki4kj8VOhs3z1WTeIl2xfL4xcJ3jtCWGpbh';
   const LOSANT_ACCESS_KEY = 'a76e4a43-2b2c-4c8d-85d9-6a8e98ee62e7';
   ```

2. Added function to forward data to Losant:
   ```javascript
   // Function to forward data to Losant webhook
   async function forwardToLosant(data) {
       try {
           console.log('Forwarding data to Losant webhook:', JSON.stringify(data, null, 2));
           
           const response = await axios.post(LOSANT_WEBHOOK_URL, data, {
               headers: {
                   'Content-Type': 'application/json',
                   'Authorization': `Bearer ${LOSANT_ACCESS_KEY}`
               }
           });
           
           console.log('Losant webhook response:', response.status, response.statusText);
           return true;
       } catch (error) {
           console.error('Error forwarding to Losant webhook:', error.message);
           if (error.response) {
               console.error('Response status:', error.response.status);
               console.error('Response data:', error.response.data);
           }
           return false;
       }
   }
   ```

3. Updated webhook endpoint to forward data to Losant:
   ```javascript
   // Webhook endpoint to receive data from TTN
   app.post('/webhooks', async (req, res) => {
       try {
           console.log('Received webhook:', JSON.stringify(req.body, null, 2));
           
           // Check if this is a valid uplink message
           if (req.body && req.body.uplink_message && req.body.uplink_message.frm_payload) {
               // Process raw payload
               // ...
               
               // Forward the data to Losant webhook
               await forwardToLosant({
                   ...req.body,
                   decoded_payload: decoded.data
               });
           } 
           // Check if the payload is already decoded
           else if (req.body && req.body.uplink_message && req.body.uplink_message.decoded_payload) {
               // Process pre-decoded payload
               // ...
               
               // Forward the data to Losant webhook
               await forwardToLosant(req.body);
           }
           
           // Respond to TTN
           res.status(200).send('OK');
       } catch (error) {
           console.error('Error processing webhook:', error);
           res.status(500).send('Error processing webhook');
       }
   });
   ```

### Dependencies
The application requires the following dependencies:
- express
- socket.io
- axios

These can be installed using npm:
```
npm install express socket.io axios
```

## Testing
The application was tested using a simulated TTN webhook payload. The test confirmed that:
1. The server correctly receives and processes the payload
2. The data is stored in the dataStore array
3. The data is emitted to connected clients via Socket.IO
4. The data is successfully forwarded to the Losant webhook

## Usage
1. Start the server:
   ```
   node server.js
   ```

2. The server will listen on port 3000 by default
3. The webhook endpoint is available at `http://localhost:3000/webhooks`
4. The web interface is available at `http://localhost:3000`

## Conclusion
The Agricultural Monitoring System now successfully integrates with The Things Stack V3 API and forwards data to Losant for further processing and visualization. The system maintains its existing functionality while adding the new integration with Losant.
