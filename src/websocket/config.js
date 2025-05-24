
module.exports = {
  authToken: 's3cr3tV4lu3',
  testUuid: 'test_uuid',
  testUserId: 'demo_has_balance',
  sidUrl: `https://gp3wrsuasd4vnlh4wiwuqbwqhi0lgilz.lambda-url.ap-southeast-1.on.aws/mock-wallet/sid`,
  launchUrl: 'https://onboard.uat.buffalo888.com/launch',
  WS_BASE_URL: 'wss://br9131tad1.execute-api.ap-southeast-1.amazonaws.com/uat',

  getWebSocketUrl: (token, lang) => {
    return `${module.exports.WS_BASE_URL}?token=${encodeURIComponent(token)}&lang=${encodeURIComponent(lang)}`;
  }
};