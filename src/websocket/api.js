const { sidUrl, launchUrl, testUuid, testUserId, authToken } = require('./config');

async function getSid() {
  const body = JSON.stringify({ uuid: testUuid, userId: testUserId });
  const response = await fetch(`${sidUrl}?authToken=${authToken}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });
  if (!response.ok) throw new Error(`SID request failed: ${response.status}`);
  return (await response.json()).sid;
}

async function callLaunchApi(sid) {
  const body = JSON.stringify({
    operatorId: 'op001',
    gameTypeId: 'slot',
    player: {
      userId: testUserId,
      currency: 'USD',
      language: 'en',
      sid,
      name: 'testUser',
    },
    apiSecret: '53XbWSzKwEtAQBAjSB3wSKznHeDHMWqqcMLKNK1U',
  });
  const response = await fetch(launchUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });
  if (!response.ok) throw new Error(`Launch API failed: ${response.status}`);
  const data = await response.json();
  const redirect = new URL(data.vals.data.redirectUrl);
  return {
    token: redirect.searchParams.get('token'),
    lang: redirect.searchParams.get('lang'),
  };
}

module.exports = { getSid, callLaunchApi };