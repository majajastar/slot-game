const express = require('express');
const path = require('path');
const app = express();
const PORT = 3000;

// Config values — replace these with your real URLs and tokens
const sidApiUrl = 'https://gp3wrsuasd4vnlh4wiwuqbwqhi0lgilz.lambda-url.ap-southeast-1.on.aws/mock-wallet/sid';
const launchUrl = 'https://onboard.uat.buffalo888.com/launch';
const authToken = 's3cr3tV4lu3';

// Middleware to parse JSON bodies
app.use(express.json());

// Serve frontend static files (index.html, js, css, assets) from 'public' folder

app.use(express.static(path.join(__dirname, '')));

// Proxy POST /api/getSid
app.post('/api/getSid', async (req, res) => {
  try {
    const { uuid, userId } = req.body;

    const response = await fetch(`${sidApiUrl}?authToken=${authToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uuid, userId }),
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: 'SID request failed' });
    }

    const data = await response.json();
    res.json({ sid: data.sid });
  } catch (err) {
    console.error('Error fetching SID:', err);
    res.status(500).json({ error: err.message });
  }
});

// Proxy POST /api/launch
app.post('/api/launch', async (req, res) => {
  try {
    const { sid, userId } = req.body.player;
    const response = await fetch(launchUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        operatorId: 'op001',
        gameTypeId: 'slot',
        player: {
          userId,
          currency: 'USD',
          language: 'en',
          sid,
          name: 'testUser',
        },
        apiSecret: '53XbWSzKwEtAQBAjSB3wSKznHeDHMWqqcMLKNK1U',
      }),
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: 'Launch API failed' });
    }

    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error('Error launching game:', err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});