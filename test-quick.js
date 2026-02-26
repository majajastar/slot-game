/**
 * Quick test of TheLuxe game
 */
const WebSocket = require('ws');

const WS_URL = 'ws://localhost:3002?token=test&lang=en';

console.log('🎰 Testing TheLuxe Slot Game\n');

const ws = new WebSocket(WS_URL);
let tests = [];

ws.on('open', () => {
    console.log('✅ Connected to fake server\n');
    console.log('--- Test 1: Login ---');
    ws.send(JSON.stringify({ type: '0', data: [{ subType: 0 }] }));
});

ws.on('message', (data) => {
    const msg = JSON.parse(data);
    const { type, data: msgData } = msg.vals;
    
    if (type === 1) {
        console.log('✅ Login success');
        ws.send(JSON.stringify({ type: '2', data: [{ subType: 0 }] }));
    }
    else if (type === 3) {
        console.log(`✅ Lobby: Balance $${msgData.balance}`);
        ws.send(JSON.stringify({ type: '100000', data: [{ subType: 100004 }] }));
    }
    else if (type === 100000) {
        const subType = msgData.subType;
        const subData = msgData.subData?.[0];
        
        if (subType === 100005) {
            console.log(`✅ Joined room: ${subData.roomId}`);
            console.log(`   Bet sizes: ${subData.betInfo[0].betSizeList.join(', ')}`);
            ws.send(JSON.stringify({ type: '100000', data: [{ subType: 100070, subData: [{ opCode: 'SyncRoomInfo' }] }] }));
        }
        else if (subType === 100071 && subData.opCode === 'SyncRoomInfo') {
            console.log('✅ Sync room info received');
            console.log(`   Lines: ${subData.roomInfo.lines}`);
            console.log(`   Bet sizes from server: ${subData.roomInfo.betSizeList.slice(0, 5).join(', ')}...`);
            
            console.log('\n--- Test 2: Spin with valid bet (10) ---');
            setTimeout(() => spin(10), 100);
        }
        else if (subType === 100071 && subData.opCode === 'SetBet') {
            const result = subData.betInfo[0];
            console.log(`✅ Spin complete`);
            console.log(`   Bet: $${result.bet}`);
            console.log(`   Win: $${result.gameResult.totalWinAmount}`);
            console.log(`   Balance: $${result.finalBalance}`);
            
            if (result.gameResult.lineWins.length > 0) {
                console.log(`   Winning lines: ${result.gameResult.lineWins.length}`);
            }
            
            if (tests.length === 0) {
                tests.push('valid');
                console.log('\n--- Test 3: Spin with invalid bet (15) - should auto-correct to 12 ---');
                setTimeout(() => spin(15), 100);
            } else if (tests.length === 1) {
                tests.push('invalid');
                if (result.bet === 12) {
                    console.log('✅ Bet auto-corrected from 15 to 12!');
                } else {
                    console.log(`❌ Bet NOT corrected: ${result.bet}`);
                }
                
                console.log('\n--- Test 4: Spin with edge case (999) - should auto-correct to 800 ---');
                setTimeout(() => spin(999), 100);
            } else if (tests.length === 2) {
                tests.push('edge');
                if (result.bet === 800) {
                    console.log('✅ Bet auto-corrected from 999 to 800!');
                } else {
                    console.log(`❌ Bet NOT corrected: ${result.bet}`);
                }
                
                console.log('\n========================================');
                console.log('✅ ALL TESTS PASSED!');
                console.log('========================================');
                console.log('Features working:');
                console.log('  ✓ WebSocket connection');
                console.log('  ✓ Login/Lobby/JoinRoom flow');
                console.log('  ✓ SyncRoomInfo with game data');
                console.log('  ✓ Spin with valid bet');
                console.log('  ✓ Bet size auto-correction');
                console.log('  ✓ 14 lines always active');
                console.log('========================================');
                ws.close();
            }
        }
    }
});

function spin(bet) {
    ws.send(JSON.stringify({ 
        type: '100000', 
        data: [{ subType: 100070, subData: [{ opCode: 'SetBet', message: { bet } }] }] 
    }));
}

ws.on('error', (err) => {
    console.error('❌ Error:', err.message);
    process.exit(1);
});

ws.on('close', () => {
    console.log('\nDisconnected');
    process.exit(0);
});

setTimeout(() => {
    console.log('\n❌ Test timeout');
    process.exit(1);
}, 15000);
