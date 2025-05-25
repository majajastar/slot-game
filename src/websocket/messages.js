function createMessage(type, data) {
  return JSON.stringify({ type, data });
}

export const login = () => createMessage('0', [{ subType: 0 }]);

export const lobby = () => createMessage('2', [{ subType: 0 }]);

export const joinRoom = () => createMessage('100000', [{ subType: 100004 }]);

export const transfer = () => createMessage('200017', [{ subType: 200017 }]);

export const getRecords = () =>
  createMessage('100000', [
    { subType: 100070, subData: [{ opCode: 'GetRecords' }] },
  ]);

export const syncRoomInfo = () =>
  createMessage('100000', [
    { subType: 100070, subData: [{ opCode: 'SyncRoomInfo' }] },
  ]);

export const setBet = (bet, line) =>
  createMessage('100000', [
    {
      subType: 100070,
      subData: [{ opCode: 'SetBet', message: { bet, line } }],
    },
  ]);