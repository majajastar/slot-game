import * as messages from './messages.js';

export class MessageHandler {
  constructor(socket, onMessageCallback) {
    this.socket = socket;

    // Stored state
    this.loginData = null;
    this.lobbyData = null;
    this.roomData = null;
    this.roomStatus = null;
    this.onMessageCallback = onMessageCallback;
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
    console.log('===[Login]===');
    console.log(`🆔 Session ID: ${data.sessionId} | 👤 Player ID: ${data.playerId} | 🌐 Lobby IP: ${data.lobbyServerIp}:${data.lobbyServerPort}`);

    this.onMessageCallback('login', data);
  }

  // Store lobby data
  handleLobby(data) {
    if (data.errCode !== 0) {
      console.error(`Data error code (type 3): ${data.errCode}`);
      return;
    }

    this.lobbyData = data;
    console.log('===[Lobby]===');
    console.log(`🎮 Game ID: ${data.gameId} | 💰 Balance: ${data.balance} | 🕒 Server Time: ${data.serverTime} | 💱 Currency: ${data.currency} | 👜 Wallet Type: ${data.walletType}`);

    this.onMessageCallback('lobby', data);
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
    console.log('===[Joined room]===');
    console.log(`🎮 Game Type: ${data.gameType} | 🏠 Room ID: ${data.roomId} | 💰 Balance: ${data.balance.toLocaleString()}`);

    console.log("🎲 Bet Info:");
    data.betInfo.forEach((bet, idx) => {
      console.log(`[${idx}] Game: ${bet.gameName} | Min Bet: ${bet.minBet} | Max Bet: ${bet.maxBet} | Default Bet: ${bet.defaultBet} | Decimal Allowed: ${bet.decimalCount}`);
    });

    console.log("💱 Currency Info:");
    data.currencyInfo.forEach((currency, idx) => {
      console.log(`[${idx}] Currency ID: ${currency.currencyId} | Symbol: ${currency.currency}`);
    });
    this.onMessageCallback('joinRoom', data);
    //this.socket.send(messages.transfer());
    //this.socket.send(messages.getRecords());
    //this.socket.send(messages.syncRoomInfo());
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
        const roomInfo = subData.roomInfo;
        const minBet = parseFloat(roomInfo.minBet);
        const maxBet = parseFloat(roomInfo.maxBet);
        const winningPatterns = roomInfo.winningPatterns;  // Object of patternId -> array of positions
        const multipliers = roomInfo.multipliers;          // Array of arrays with multiplier values
        const recordList = roomInfo.recordList;            // Empty array here
        console.log("===[Parsed Room Info] ===");
        //console.log('Winning Patterns:', winningPatterns);
        //console.log('Multipliers:', multipliers);
        this.onMessageCallback('SyncRoomInfo', subData);
        break;
      case 'SetBet':
        const info = subData.betInfo[0];
        const result = info.gameResult;
        console.log("===[Parsed Bet Info] ===");
        //console.log(`Error Code: ${subData.errCode}`);
        //console.log(`Operation Code: ${subData.opCode}`);
        //console.log(`Bet Amount: ${info.bet}`);
        //console.log(`Line: ${info.line}`);
        //console.log(`Round ID: ${info.roundId}`);
        //console.log(`Balance: ${info.balance.toFixed(2)}`);
        console.log(`Final Balance: ${info.finalBalance.toFixed(2)}`);
        //console.log("Award Base:", result.awardBase);
        //console.log("Win Amount:", result.winAmount);
        //console.log("Final Symbols:");
        result.finalSymbols.forEach(row => console.log("  ", row.join(", ")));
        console.log("Match Details:", result.matchDetails.length ? result.matchDetails : "[]");
        this.onMessageCallback('SetBet', subData);
        break;
      default:
        console.warn('[SubData] Unknown opCode:', subData.opCode);
    }
  }

  // Store room status
  handleRoomStatus(data) {
    this.roomStatus = data;
    console.log('===[Room Status]===');
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
