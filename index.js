import express from 'express';
import axios from 'axios';
import cors from 'cors';
import { randomBytes } from 'crypto';

const app = express();
app.use(cors());
app.use(express.json());

// --- Configuration ---
const WGEASY_URL = 'http://130.61.125.12:51821';
const WGEASY_PASSWORD = 'Namaste30!';
// ----------------------------------------------------

app.post('/api/generate-config', async (req, res) => {
    console.log("Received request to generate config...");

    try {
        // Step 1: Log in to wg-easy and get a session cookie
        console.log("Logging into wg-easy...");
        const loginResponse = await axios.post(`${WGEASY_URL}/api/session`, {
            password: WGEASY_PASSWORD,
        });

        const cookie = loginResponse.headers['set-cookie'];
        if (!cookie) {
            throw new Error('Could not get session cookie from wg-easy.');
        }
        const sessionCookie = Array.isArray(cookie) ? cookie.join('; ') : cookie;
        console.log("Successfully logged into wg-easy.");

        // Step 2: Create a new VPN client with a random name
        console.log("Creating new VPN client...");
        const clientName = `user-${randomBytes(4).toString('hex')}`;
        const createClientResponse = await axios.post(
            `${WGEASY_URL}/api/wireguard/client`,
            { name: clientName },
            { headers: { Cookie: sessionCookie } }
        );
        const newClientId = createClientResponse.data.id;
        console.log(`VPN Client created with ID: ${newClientId}`);

        // ✅ FIX: Step 3: Fetch the correctly formatted configuration file
        console.log("Fetching formatted configuration for the new client...");
        const getConfigResponse = await axios.get(
            `${WGEASY_URL}/api/wireguard/client/${newClientId}/configuration`,
            { headers: { Cookie: sessionCookie } }
        );

        console.log("Configuration fetched. Sending config back.");
        // Step 4: Send the formatted configuration back to the user's app
        res.setHeader('Content-Type', 'text/plain');
        res.send(getConfigResponse.data); // Send the correct data

    } catch (error) {
        console.error("An error occurred:", error.response?.data || error.message);
        res.status(500).json({ error: 'Failed to generate VPN configuration.' });
    }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`✅ Backend server running on port ${PORT}`);
    console.log('Waiting for requests from your Mini App...');
});
