import express from 'express';
import cors from 'cors';
import axios from 'axios';

const app = express();
app.use(cors());
app.use(express.json());

// --- Configuration ---
const WGEASY_URL = 'http://130.61.125.12:51821';
const WGEASY_PASSWORD = 'Namaste30!';
const WORLDCOIN_APP_ID = 'app_9cb7030e593b562a6293cfb517946b15';
const WORLDCOIN_ACTION = 'vpnlogin';
// ----------------------------------------------------

app.post('/api/generate-config', async (req, res) => {
    console.log("Received request to generate config...");
    try {
        // 1. Verify the World ID proof via direct API call
        console.log("Verifying World ID proof via API...");
        // ✅ FIX: Added verification_level to the list of variables received from the frontend
        const { proof, merkle_root, nullifier_hash, verification_level } = req.body;
        const verifyRes = await axios.post(
            `https://developer.worldcoin.org/api/v2/verify/${WORLDCOIN_APP_ID}`,
            {
                proof: proof,
                merkle_root: merkle_root,
                nullifier_hash: nullifier_hash,
                action: WORLDCOIN_ACTION,
                verification_level: verification_level, // ✅ FIX: Added verification_level to the data sent to Worldcoin
            },
            { headers: { 'Content-Type': 'application/json' } }
        );

        if (verifyRes.status !== 200 || !verifyRes.data.success) {
            console.error("World ID verification failed:", verifyRes.data);
            return res.status(400).json({ error: 'World ID proof could not be verified.' });
        }
        console.log("Proof verified for nullifier:", nullifier_hash);

        // 2. Log in to wg-easy to get a session cookie
        console.log("Logging into wg-easy...");
        const loginResponse = await axios.post(`${WGEASY_URL}/api/session`, {
            password: WGEASY_PASSWORD,
        });
        const cookie = loginResponse.headers['set-cookie'];
        if (!cookie) {
            throw new Error('Could not get session cookie from wg-easy.');
        }
        console.log("Successfully logged into wg-easy.");

        // 3. Create a new VPN client using the cookie
        console.log("Creating new VPN client...");
        const clientName = `worldcoin-${nullifier_hash.slice(0, 8)}`;
        const createClientResponse = await axios.post(
            `${WGEASY_URL}/api/wireguard/client`,
            { name: clientName },
            { headers: { Cookie: Array.isArray(cookie) ? cookie.join('; ') : cookie } }
        );

        console.log("VPN Client created. Sending config back.");
        // 4. Send the real VPN configuration back to the app
        res.setHeader('Content-Type', 'text/plain');
        res.send(createClientResponse.data);

    } catch (error) {
        const errorDetails = error.response ? error.response.data : error.message;
        console.error("An error occurred:", errorDetails);
        res.status(500).json({ error: 'Failed to generate VPN configuration.', details: errorDetails });
    }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`✅ Backend server running on port ${PORT}`);
    console.log('Waiting for requests from your Mini App...');
});
