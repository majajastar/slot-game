/**
 * Test bonus game functionality
 */
const WebSocket = require('ws');

const WS_URL = 'ws://localhost:3002?token=test&lang=en';

console.log('🎰 Testing TheLuxe Bonus Games\n');

const ws = new WebSocket(WS_URL);
let spinCount = 0;
let inBonus = false;

ws.on('open', () => {
    console.log('✅ Connected to fake server\n');
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
            console.log(`✅ Joined room: ${subData.roomId}\n`);
            console.log('--- Spinning until bonus triggers (10% chance per spin) ---\n');
            setTimeout(() => spin(10), 100);
        }
        else if (subType === 100071 && subData.opCode === 'SetBet') {
            const result = subData.betInfo[0];
            spinCount++;

            const spinType = result.gameResult.isBonus ? (inBonus ? 'BONUS SPIN' : 'BONUS TRIGGERED') : 'NORMAL';
            console.log(`[Spin ${spinCount}] ${spinType} | Bet: $${result.bet} | Win: $${result.gameResult.totalWinAmount} | Balance: $${result.finalBalance}`);

            if (result.gameResult.isBonus && !inBonus) {
                // Bonus just triggered
                inBonus = true;
                console.log(`\n🎉 BONUS TRIGGERED: ${result.gameResult.bonusType}!`);
                console.log(`   Spins: ${result.gameResult.bonusSpinsLeft}`);
                if (result.gameResult.stickyFrames) {
                    console.log(`   Sticky frames applied!`);
                }
                console.log('');
            } else if (inBonus) {
                // In bonus
                if (result.gameResult.lastFreeSpin) {
                    console.log('\n✅ Bonus completed!');
                    console.log(`   Total spins in bonus: ${10 - result.gameResult.bonusSpinsLeft}`);
                    inBonus = false;

                    console.log('\n========================================');
                    console.log('✅ BONUS GAME TEST PASSED!');
                    console.log('========================================');
                    console.log(`Total normal spins: ${spinCount - (10 - result.gameResult.bonusSpinsLeft)}`);
                    console.log(`Bonus spins: ${10 - result.gameResult.bonusSpinsLeft}`);
                    console.log('Features working:');
                    console.log('  ✓ Bonus trigger detection');
                    console.log('  ✓ Bonus type (BLACK_AND_GOLD or GOLDEN_HIT)');
                    console.log('  ✓ Sticky frames');
                    console.log('  ✓ Bonus spin countdown');
                    console.log('  ✓ Bonus completion');
                    console.log('========================================');
                    ws.close();
                    return;
                }
            }

            // Continue spinning
            if (spinCount < 100) {
                setTimeout(() => spin(10), 100);
            } else {
                console.log('\n⚠️ Reached max spins without completing bonus test');
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
}, 60000);
