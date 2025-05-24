const WebSocket = require('ws');
const readline = require('readline');
const { getSid, callLaunchApi } = require('./api');
const { MessageHandler } = require('./handlers');
const { handleCLI } = require('./cli');
const messages = require('./messages');
const { getWebSocketUrl } = require('./config');

class WebSocketClient {
  constructor() {
    this.socket = null;
    this.messageHandler = null;
  }

  async connect() {
    const sid = await getSid();
    const { token, lang } = await callLaunchApi(sid);
    const wsUrl = getWebSocketUrl(token, lang);    this.socket = new WebSocket(wsUrl);
    this.messageHandler = new MessageHandler(this.socket); // Use class instance

    this.socket.on('open', () => this.onOpen());
    this.socket.on('message', (data) => this.onMessage(data));
    this.socket.on('error', (err) => console.error('WebSocket error:', err));
    this.socket.on('close', (code, reason) => console.log(`Closed: ${code} ${reason}`));

    readline.createInterface({ input: process.stdin })
      .on('line', line => handleCLI(this.socket, line));
  }

  onOpen() {
    console.log('WebSocket connected');
    this.socket.send(messages.login());
  }

  onMessage(data) {
    try {
      const message = JSON.parse(data);
      this.messageHandler.handle(message);
    } catch (e) {
      console.error('Invalid message:', e);
    }
  }
}

new WebSocketClient().connect();
