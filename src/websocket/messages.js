function createMessage(type, data) {
  return JSON.stringify({ type, data });
}

module.exports = {
  login: () => createMessage('0', [{ subType: 0 }]),
  lobby: () => createMessage('2', [{ subType: 0 }]),
  joinRoom: () => createMessage('100000', [{ subType: 100004 }]),
  transfer: () => createMessage('200017', [{ subType: 200017 }]),
  getRecords: () => createMessage('100000', [{ subType: 100070, subData: [{ opCode: 'GetRecords' }] }]),
  syncRoomInfo: () => createMessage('100000', [{ subType: 100070, subData: [{ opCode: 'SyncRoomInfo' }] }]),
  setBet: (bet, line) => createMessage('100000', [{ subType: 100070, subData: [{ opCode: 'SetBet', message: { bet, line } }] }]),
};