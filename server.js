// server.js
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Middleware to parse JSON bodies
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// TTN Configuration
const TTN_APP_ID = 'agriculturalmsyst-du';
const TTN_DEVICE_ID = 'wio-e5-du';
const API_KEY = 'NNSXS.UHC6K67PZFYE2V5OGHQGYNNR2U2LHM6WC3WKPEY.WNXVZWT35X2WOQFZSYVBRTNQV5TKA6UNO44PAYDTVZJTLRVOXLLQ';

// Losant Configuration
const LOSANT_WEBHOOK_URL = 'https://triggers.losant.com/webhooks/yLCyBki4kj8VOhs3z1WTeIl2xfL4xcJ3jtCWGpbh';
const LOSANT_ACCESS_KEY = 'a76e4a43-2b2c-4c8d-85d9-6a8e98ee62e7';

// Store for sensor data
const dataStore = [];
const MAX_STORED_ENTRIES = 100;

// TTN Payload Decoder (JavaScript formatter from your data)
function decodeUplink(input) {
    var bytes = input.bytes;

    if (bytes.length !== 7) {
        return { errors: ["Invalid payload length"] };
    }

    var tempC = ((bytes[0] << 8) | bytes[1]) / 100.0;
    var tempF = (tempC * 9/5) + 32;  // Convert Celsius to Fahrenheit
    var hum = ((bytes[2] << 8) | bytes[3]) / 100.0;
    var light = (bytes[4] << 8) | bytes[5];
    var moisture = bytes[6];

    return {
        data: {
            temperature: tempF.toFixed(2) + " °F",
            humidity: hum.toFixed(2) + " %",
            light: light + " lm",
            moisture: moisture + " %"
        }
    };
}

// Function to decode base64 payload
function base64ToBytes(base64) {
    const binary = Buffer.from(base64, 'base64').toString('binary');
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

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

// Serve the main HTML file
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// API endpoint to get historical data
app.get('/api/data', (req, res) => {
    res.json(dataStore);
});

// Webhook endpoint to receive data from TTN
app.post('/webhooks', async (req, res) => {
    try {
        console.log('Received webhook:', JSON.stringify(req.body, null, 2));
        
        // Check if this is a valid uplink message
        if (req.body && req.body.uplink_message && req.body.uplink_message.frm_payload) {
            const payloadBase64 = req.body.uplink_message.frm_payload;
            const bytes = base64ToBytes(payloadBase64);
            
            // Decode the payload using the provided formatter
            const decoded = decodeUplink({ bytes });
            
            if (decoded && decoded.data) {
                // Add timestamp
                const sensorData = {
                    ...decoded.data,
                    timestamp: new Date().toISOString()
                };
                
                // Store the data
                dataStore.push(sensorData);
                if (dataStore.length > MAX_STORED_ENTRIES) {
                    dataStore.shift(); // Remove oldest entry if we exceed max size
                }
                
                // Emit the data to all connected clients
                io.emit('data', sensorData);
                
                console.log('Processed sensor data:', sensorData);
                
                // Forward the data to Losant webhook
                await forwardToLosant({
                    ...req.body,
                    decoded_payload: decoded.data
                });
            }
        } 
        // Check if the payload is already decoded (TTN v3 API sometimes sends decoded payload)
        else if (req.body && req.body.uplink_message && req.body.uplink_message.decoded_payload) {
            const decodedPayload = req.body.uplink_message.decoded_payload;
            
            // Add timestamp
            const sensorData = {
                ...decodedPayload,
                timestamp: new Date().toISOString()
            };
            
            // Store the data
            dataStore.push(sensorData);
            if (dataStore.length > MAX_STORED_ENTRIES) {
                dataStore.shift(); // Remove oldest entry if we exceed max size
            }
            
            // Emit the data to all connected clients
            io.emit('data', sensorData);
            
            console.log('Processed pre-decoded sensor data:', sensorData);
            
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

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log('Client connected');
    
    // Send historical data when requested
    socket.on('request-historical-data', () => {
        socket.emit('historical-data', dataStore);
    });
    
    socket.on('disconnect', () => {
        console.log('Client disconnected');
    });
});

// Save data to file before shutting down
function saveDataToFile() {
    try {
        fs.writeFileSync(
            path.join(__dirname, 'data.json'),
            JSON.stringify(dataStore),
            'utf8'
        );
        console.log('Data saved to file');
    } catch (error) {
        console.error('Error saving data to file:', error);
    }
}

// Load data from file on startup
function loadDataFromFile() {
    try {
        if (fs.existsSync(path.join(__dirname, 'data.json'))) {
            const data = JSON.parse(
                fs.readFileSync(path.join(__dirname, 'data.json'), 'utf8')
            );
            dataStore.push(...data);
            console.log(`Loaded ${data.length} data points from file`);
        }
    } catch (error) {
        console.error('Error loading data from file:', error);
    }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('Shutting down...');
    saveDataToFile();
    process.exit();
});

// Load data on startup
loadDataFromFile();

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Webhook endpoint: http://localhost:${PORT}/webhooks`);
    console.log(`Forwarding to Losant webhook: ${LOSANT_WEBHOOK_URL}`);
});
