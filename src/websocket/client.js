import { getSid, callLaunchApi } from './api.js';
import { MessageHandler } from './handlers.js';
import * as messages from './messages.js';
import { getWebSocketUrl } from './config.js';
import readline from 'node:readline';

// Setup readline interface for keyboard input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

export class WebSocketClient {
  constructor(onMessageCallback) {
    this.socket = null;
    this.messageHandler = null;
    // Set a default empty function so it never crashes if no callback is provided
    this.onMessageCallback =
      onMessageCallback ||
      ((type, message) => {
        this.handleMessage(type, message);
      });
  }

  async connect() {
    const sid = await getSid();
    //console.log(`sid: ${sid}`)
    const { token, lang } = await callLaunchApi(sid);
    //console.log(`token = ${token}, lang = ${lang}`)
    const wsUrl = getWebSocketUrl(token, lang);
    this.socket = new WebSocket(wsUrl, {
      headers: {
        "Origin": "https://theluxe.uat.buffalo888.com"
      }
    });
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
  handleMessage(type, message) {
    console.log(`message = ${JSON.stringify(message)}`)
    if (type === 'login') {
      this.socket.send(messages.lobby());
    } else if (type === 'lobby') {
      this.socket.send(messages.joinRoom());
      this.socket.send(messages.syncRoomInfo());
      // Send ping message every 20 seconds
      if (this.pingInterval) {
        clearInterval(this.pingInterval);
      }
      this.pingInterval = setInterval(() => {
        if (this.isConnected()) {
          this.socket.send(messages.syncRoomInfo());
        }
      }, 20000);
    } else if (type === 'joinRoom') {

    } else if (type === 'SyncRoom') {


    } else if (type === 'SetBet') {
    }
  }

}

// 1. Create the instance first
const client = new WebSocketClient();

// 2. Call connect (you can just let it run in the background)
client.connect();

// 3. Update the CLI listener to use the 'client' instance
rl.on('line', function (line) {
  if (line === 's') {
    // Check if connected before sending
    if (client.isConnected()) {
      const betMessage = JSON.stringify({
        type: '100000',
        data: [{
          subType: 100070,
          subData: [{
            opCode: 'SetBet',
            message: { bet: 100, line: 14 }
          }]
        }],
      });
      client.socket.send(betMessage);
      console.log('Message sent:', line);
    } else {
      console.log('Cannot send: WebSocket is not connected yet.');
    }
  } else {
    console.log("Unknown command:", line);
  }
});