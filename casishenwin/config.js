const CONFIG = {
    serverMode: 'fake', // 'fake' or 'real'
    fakeServerUrl: 'ws://localhost:3002',
    realServerUrl: 'ws://your-aws-server.com',
    autoReconnect: true,
    reconnectInterval: 3000
};

module.exports = CONFIG;
