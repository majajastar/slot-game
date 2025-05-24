const messages = require('./messages');

function handleCLI(socket, line) {
  const map = {
    '0': messages.login,
    '2': messages.lobby,
    'a': messages.joinRoom,
    'b': messages.transfer,
    'c': messages.getRecords,
    'd': messages.syncRoomInfo,
    'e': () => messages.setBet(10, 20),
    // Add other commands as needed
  };

  const send = map[line];
  if (send) socket.send(send());
  else console.log('Unknown command');
}

module.exports = { handleCLI };