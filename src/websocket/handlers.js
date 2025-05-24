const messages = require('./messages');

class MessageHandler {
  constructor(socket) {
    this.socket = socket;

    // Stored state
    this.loginData = null;
    this.lobbyData = null;
    this.roomData = null;
    this.roomStatus = null;
  }

  // Central dispatch method
  handle(message) {
    if (message.errCode !== 0) {
      return console.error(`Error from server: ${message.errCode}`);
    }

    const { type, data } = message.vals;

    switch (type) {
      case 1:
        return this.handleLogin(data);
      case 3:
        return this.handleLobby(data);
      case 100000:
        return this.handleGameMessage(data);
      case 200018:
        return this.handleRoomStatus(data);
      default:
        console.warn(`Unhandled message type: ${type}`);
    }
  }

  // Store login data
  handleLogin(data) {
    if (data.errCode !== 0) {
      console.error(`Data error code: ${data.errCode}`);
      return;
    }

    this.loginData = data;
    console.log('======[Login]======');
    console.log('Session ID:', data.sessionId);
    console.log('Player ID:', data.playerId);
    console.log('Lobby Server IP:', data.lobbyServerIp);
    console.log('Lobby Server Port:', data.lobbyServerPort);

    this.socket.send(messages.lobby());
  }

  // Store lobby data
  handleLobby(data) {
    if (data.errCode !== 0) {
      console.error(`Data error code (type 3): ${data.errCode}`);
      return;
    }

    this.lobbyData = data;
    console.log('======[Lobby]======');
    console.log('Game ID:', data.gameId);
    console.log('Balance:', data.balance);
    console.log('Server Time:', data.serverTime);
    console.log('Currency:', data.currency);
    console.log('Wallet Type:', data.walletType);

    this.socket.send(messages.joinRoom());
  }

  handleGameMessage(data) {
    const subType = data.subType;
    const subData = data.subData?.[0];

    switch (subType) {
      case 100005:
        return this.handleJoinRoom(subData);
      case 100071:
        return this.handleSubData(subData);
      default:
        console.warn(`[Game] Unknown subType: ${subType}, data: ${JSON.stringify(data)}`);
    }
  }

  // Store room data
  handleJoinRoom(data) {
    this.roomData = data;
    console.log('======[Game] Joined room======');
    console.log("🎮 Game Type:", data.gameType);
    console.log("🏠 Room ID:", data.roomId);
    console.log("💰 Balance:", data.balance.toLocaleString());

    console.log("\n🎲 Bet Info:");
    data.betInfo.forEach((bet, idx) => {
      console.log(`  [${idx}] Game: ${bet.gameName}`);
      console.log(`      Min Bet: ${bet.minBet}`);
      console.log(`      Max Bet: ${bet.maxBet}`);
      console.log(`      Default Bet: ${bet.defaultBet}`);
      console.log(`      Decimal Allowed: ${bet.decimalCount}`);
    });

    console.log("\n💱 Currency Info:");
    data.currencyInfo.forEach((currency, idx) => {
      console.log(`  [${idx}] Currency ID: ${currency.currencyId}`);
      console.log(`      Symbol: ${currency.currency}`);
    });

    this.socket.send(messages.transfer());
    this.socket.send(messages.getRecords());
    this.socket.send(messages.syncRoomInfo());
  }

  handleSubData(subData) {
    if (!subData || !subData.opCode) {
      return console.warn('[SubData] Missing opCode');
    }

    switch (subData.opCode) {
      case 'GetRecords':
        console.log('[Records] subData: ', JSON.stringify(subData));
        break;
      case 'SyncRoomInfo':
        console.log('[Room Info] subData: ', JSON.stringify(subData));
        break;
      case 'SetBet':
        console.log('[Bet Result] subData: ', JSON.stringify(subData));
        break;
      default:
        console.warn('[SubData] Unknown opCode:', subData.opCode);
    }
  }

  // Store room status
  handleRoomStatus(data) {
    this.roomStatus = data;
    console.log('======[Room Status]======');
    console.log("🎮 Game Type:", data.gameType);
    console.log("🏠 Room Index:", data.roomIndex);
    console.log("🚪 Is Occupied:", data.isOccupied ? "Yes" : "No");

    const ticks = BigInt(data.reserveExpiredTime);
    const epochTicks = BigInt("621355968000000000");
    const ticksPerMillisecond = BigInt(10000);
    const msSinceEpoch = (ticks - epochTicks) / ticksPerMillisecond;
    const jsDate = new Date(Number(msSinceEpoch));

    console.log("⏳ Reservation Expires At:", jsDate.toLocaleString());
  }

  // Optional getters
  getLoginData() {
    return this.loginData;
  }

  getLobbyData() {
    return this.lobbyData;
  }

  getRoomData() {
    return this.roomData;
  }

  getRoomStatus() {
    return this.roomStatus;
  }
}

module.exports = {
  MessageHandler,
};