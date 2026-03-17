import { getFromDb, setInDb } from '../utils/database.js';
import { logger } from '../utils/logger.js';

export class TradingService {
    static async logMistake(guildId, userId, mistake) {
        try {
            const key = `trading:mistakes:${guildId}:${userId}`;
            const mistakes = await getFromDb(key, []);
            
            const entry = {
                id: Date.now(),
                mistake,
                timestamp: Date.now()
            };
            
            mistakes.push(entry);
            await setInDb(key, mistakes);
            
            logger.info(`Trading mistake logged for user ${userId} in guild ${guildId}`);
            return { success: true, entry };
        } catch (error) {
            logger.error('Error logging trading mistake:', error);
            return { success: false, error: error.message };
        }
    }

    static async getMistakes(guildId, userId) {
        const key = `trading:mistakes:${guildId}:${userId}`;
        return await getFromDb(key, []);
    }

    static async logJournal(guildId, userId, content) {
        try {
            const key = `trading:journals:${guildId}:${userId}`;
            const journals = await getFromDb(key, []);
            
            const entry = {
                id: Date.now(),
                content,
                timestamp: Date.now()
            };
            
            journals.push(entry);
            await setInDb(key, journals);
            
            logger.info(`Trading journal logged for user ${userId} in guild ${guildId}`);
            return { success: true, entry };
        } catch (error) {
            logger.error('Error logging trading journal:', error);
            return { success: false, error: error.message };
        }
    }

    static async getJournals(guildId, userId) {
        const key = `trading:journals:${guildId}:${userId}`;
        return await getFromDb(key, []);
    }

    static getRules() {
        return [
            "1. Plan your trade, trade your plan.",
            "2. Never risk more than 1-2% of your equity.",
            "3. Cut losses quickly - no exceptions.",
            "4. Don't revenge trade after a loss.",
            "5. Stay disciplined and follow your strategy.",
            "6. Keep a journal of every trade.",
            "7. Quality over quantity - wait for high probability setups."
        ];
    }

    static getChecklist() {
        return [
            "✅ Is the market in my trading window?",
            "✅ Have I identified the current trend?",
            "✅ Is there a clear support/resistance level?",
            "✅ Does this trade meet all my strategy criteria?",
            "✅ Have I calculated my position size correctly?",
            "✅ Is my stop-loss and take-profit set?",
            "✅ Am I emotionally calm and ready to trade?"
        ];
    }
}
