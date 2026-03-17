import { getFromDb, setInDb } from '../utils/database.js';
import { logger } from '../utils/logger.js';
import { WarningService } from './warningService.js';

export class StrikeService {
    static async addStrike(guildId, userId, moderatorId, reason) {
        try {
            const key = `moderation:strikes:${guildId}:${userId}`;
            const strikes = await getFromDb(key, []);
            
            const strike = {
                id: Date.now(),
                moderatorId,
                reason,
                timestamp: Date.now()
            };
            
            strikes.push(strike);
            await setInDb(key, strikes);
            
            const strikeCount = strikes.length;
            logger.info(`Strike added for ${userId} in ${guildId}. Total: ${strikeCount}`);

            let actionTaken = 'Warning';
            let penaltyApplied = false;

            if (strikeCount >= 3) {
                actionTaken = '3rd Strike: Manual review required (Recommend Mute/Kick)';
                penaltyApplied = true;
            } else if (strikeCount === 2) {
                actionTaken = '2nd Strike: Warning (Final Warning before 3 strikes)';
            }

            // Integrate with WarningService for consistency
            await WarningService.addWarning({
                guildId,
                userId,
                moderatorId,
                reason: `[STRIKE ${strikeCount}] ${reason}`,
                timestamp: strike.timestamp
            });

            return {
                success: true,
                strikeCount,
                actionTaken,
                penaltyApplied
            };
        } catch (error) {
            logger.error('Error adding strike:', error);
            return { success: false, error: error.message };
        }
    }

    static async getStrikes(guildId, userId) {
        const key = `moderation:strikes:${guildId}:${userId}`;
        return await getFromDb(key, []);
    }

    static async clearStrikes(guildId, userId) {
        const key = `moderation:strikes:${guildId}:${userId}`;
        await setInDb(key, []);
        return { success: true };
    }
}
