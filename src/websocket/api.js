import { sidUrl, launchUrl, testUuid, testUserId, authToken } from './config.js';

export async function getSid() {
  const body = JSON.stringify({ uuid: testUuid, userId: testUserId });
  console.log(`body = ${body}`)
  try{
    const response = await fetch(`${sidUrl}?authToken=${authToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });
    if (!response.ok) throw new Error(`SID request failed: ${response.status}`);
    return (await response.json()).sid;
  } catch (err) {
    console.log(err);
  }
  
}

export async function callLaunchApi(sid) {
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
  console.log(`launchUrl = ${launchUrl}`)
  const response = await fetch(launchUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });
  if (!response.ok) throw new Error(`Launch API failed: ${response.status}`);
  const text = await response.text();
  const data = JSON.parse(text);
  const redirect = new URL(data.vals.data.redirectUrl);
  return {
    token: redirect.searchParams.get('token'),
    lang: redirect.searchParams.get('lang'),
  };
}

