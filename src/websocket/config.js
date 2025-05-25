export const authToken = 's3cr3tV4lu3';
export const testUuid = 'test_uuid';
export const testUserId = 'demo_has_balance';
//export const sidUrl = `https://gp3wrsuasd4vnlh4wiwuqbwqhi0lgilz.lambda-url.ap-southeast-1.on.aws/mock-wallet/sid`;
export const sidUrl = 'https://lbucmxb2ke.execute-api.ap-southeast-1.amazonaws.com/mock-wallet/sid';
//export const launchUrl = 'https://onboard.uat.buffalo888.com/launch';
//export const launchUrl = '/api/launch'
export const launchUrl = 'https://1zka52hsdc.execute-api.ap-southeast-1.amazonaws.com/rest/game/launch';
export const WS_BASE_URL = 'wss://br9131tad1.execute-api.ap-southeast-1.amazonaws.com/uat';

export function getWebSocketUrl(token, lang) {
  return `${WS_BASE_URL}?token=${encodeURIComponent(token)}&lang=${encodeURIComponent(lang)}`;
}