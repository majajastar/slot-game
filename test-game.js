// Test script for TheLuxe fake server
const WebSocket = require('ws');

const WS_URL = 'ws://localhost:3002?token=test-token&lang=en';

console.log('Connecting to fake server...');
const ws = new WebSocket(WS_URL);

let step = 0;

ws.on('open', () => {
    console.log('✓ WebSocket connected');
    console.log('\n--- Step 1: Login ---');
    ws.send(JSON.stringify({ type: '0', data: [{ subType: 0 }] }));
});

ws.on('message', (data) => {
    const msg = JSON.parse(data);
    console.log('← Received:', JSON.stringify(msg).substring(0, 200));
    
    const { type, data: msgData } = msg.vals;
    
    if (type === 1) {
        console.log('✓ Login success, session:', msgData.sessionId);
        step++;
        console.log('\n--- Step 2: Lobby ---');
        ws.send(JSON.stringify({ type: '2', data: [{ subType: 0 }] }));
    }
    else if (type === 3) {
        console.log('✓ Lobby, balance:', msgData.balance);
        step++;
        console.log('\n--- Step 3: Join Room ---');
        ws.send(JSON.stringify({ type: '100000', data: [{ subType: 100004 }] }));
    }
    else if (type === 100000) {
        const subType = msgData.subType;
        const subData = msgData.subData?.[0];
        
        if (subType === 100005) {
            console.log('✓ Joined room:', subData.roomId);
            console.log('  Bet sizes:', subData.betInfo[0].betSizeList.join(', '));
            step++;
            console.log('\n--- Step 4: Sync Room Info ---');
            ws.send(JSON.stringify({ 
                type: '100000', 
                data: [{ subType: 100070, subData: [{ opCode: 'SyncRoomInfo' }] }] 
            }));
        }
        else if (subType === 100071) {
            if (subData.opCode === 'SyncRoomInfo') {
                console.log('✓ Sync Room Info received');
                console.log('  Bet size list from server:', subData.roomInfo.betSizeList.join(', '));
                console.log('  Lines:', subData.roomInfo.lines);
                step++;
                
                // Now test a spin
                console.log('\n--- Step 5: SPIN with bet=10 ---');
                setTimeout(() => {
                    ws.send(JSON.stringify({ 
                        type: '100000', 
                        data: [{ 
                            subType: 100070, 
                            subData: [{ opCode: 'SetBet', message: { bet: 10 } }] 
                        }] 
                    }));
                }, 500);
            }
            else if (subData.opCode === 'SetBet') {
                const result = subData.betInfo[0];
                console.log('✓ Spin result!');
                console.log('  Bet:', result.bet);
                console.log('  Win:', result.gameResult.totalWinAmount);
                console.log('  New balance:', result.finalBalance);
                console.log('  Grid preview:');
                result.gameResult.grid.forEach(row => {
                    const emojis = row.map(s => {
                        const map = {
                            'WILD': '💎', 'SYM_1': '👑', 'SYM_2': '💍', 
                            'SYM_3': '🏆', 'SYM_4': '💵', 'SYM_5': '🎲',
                            'SYM_6': '🎯', 'SYM_7': '🎰', 'SYM_8': '🪙', 'SYM_9': '💠'
                        };
                        return map[s] || s;
                    });
                    console.log('   ', emojis.join(' '));
                });
                
                if (result.gameResult.lineWins.length > 0) {
                    console.log('  Winning lines:', result.gameResult.lineWins.length);
                    result.gameResult.lineWins.forEach(lw => {
                        console.log(`    Line ${lw.info[0]+1}: ${lw.info[1]} x${lw.info[2]} = $${lw.info[3]}`);
                    });
                } else {
                    console.log('  No wins this spin');
                }
                
                step++;
                console.log('\n--- Step 6: Test invalid bet (should auto-correct) ---');
                setTimeout(() => {
                    console.log('Sending bet=15 (not in list, should auto-correct to 12)');
                    ws.send(JSON.stringify({ 
                        type: '100000', 
                        data: [{ 
                            subType: 100070, 
                            subData: [{ opCode: 'SetBet', message: { bet: 15 } }] 
                        }] 
                    }));
                }, 500);
            }
        }
    }
});

ws.on('error', (err) => {
    console.error('✗ Error:', err.message);
    process.exit(1);
});

ws.on('close', () => {
    console.log('\n✓ Connection closed');
    console.log(`\nTest completed: ${step} steps passed`);
    process.exit(0);
});

// Timeout after 10 seconds
setTimeout(() => {
    console.log('\n✗ Test timeout');
    ws.close();
    process.exit(1);
}, 10000);
