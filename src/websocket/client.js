import { getSid, callLaunchApi } from './api.js';
import { MessageHandler } from './handlers.js';
import * as messages from './messages.js';
import { getWebSocketUrl } from './config.js';

export class WebSocketClient {
  constructor(onMessageCallback) {
    this.socket = null;
    this.messageHandler = null;
    this.onMessageCallback = onMessageCallback
  }

  async connect() {
    const sid = await getSid();
    //console.log(`sid: ${sid}`)
    const { token, lang } = await callLaunchApi(sid);
    //console.log(`token = ${token}, lang = ${lang}`)
    const wsUrl = getWebSocketUrl(token, lang); this.socket = new WebSocket(wsUrl);
    this.messageHandler = new MessageHandler(this.socket, this.onMessageCallback); // Use class instance

    this.socket.addEventListener('open', () => this.onOpen());
    this.socket.addEventListener('message', (data) => this.onMessage(data));
    this.socket.addEventListener('error', (err) => console.error('WebSocket error:', err));
    this.socket.addEventListener('close', (code, reason) => console.log(`Closed: ${code} ${reason}`));

  }

  onOpen() {
    console.log('[WebSocket connected]');
    this.socket.send(messages.login());
  }

  handleSyncRoom() {

  }

  onMessage(event) {
    try {
      const message = JSON.parse(event.data);
      this.messageHandler.handle(message);
    } catch (e) {
      console.error('Invalid message:', e);
    }
  }

  isConnected() {
    return this.socket && this.socket.readyState === WebSocket.OPEN;
  }
}

//new WebSocketClient().connect();
