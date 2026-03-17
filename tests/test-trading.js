import { TradingService } from '../src/services/tradingService.js';
import { StrikeService } from '../src/services/strikeService.js';
import { initializeDatabase } from '../src/utils/database.js';
import { logger } from '../src/utils/logger.js';

async function verify() {
    logger.info("Starting Trading Service Verification...");
    
    await initializeDatabase();

    const guildId = 'test-guild';
    const userId = 'test-user';

    // Verify Trading Rules
    const rules = TradingService.getRules();
    console.log("Rules:", rules);

    // Verify Checklist
    const checklist = TradingService.getChecklist();
    console.log("Checklist:", checklist);

    // Verify Mistake Logging
    const mistakeResult = await TradingService.logMistake(guildId, userId, "Overleveraged on BTC");
    console.log("Mistake Result:", mistakeResult);

    const mistakes = await TradingService.getMistakes(guildId, userId);
    console.log("Mistakes List:", mistakes);

    // Verify Strike System
    const strikeResult = await StrikeService.addStrike(guildId, userId, 'mod-1', "Broken trading rules");
    console.log("Strike 1 Result:", strikeResult);

    const strikeResult2 = await StrikeService.addStrike(guildId, userId, 'mod-1', "Spamming during trading hours");
    console.log("Strike 2 Result:", strikeResult2);

    const strikes = await StrikeService.getStrikes(guildId, userId);
    console.log("Strikes Count:", strikes.length);

    logger.info("Verification complete.");
}

verify().catch(console.error);
