import { getFromDb, setInDb } from '../utils/database.js';
import { logger } from '../utils/logger.js';

export class TimedRoleService {
    static async addRemoval(guildId, userId, roleId, durationMs, reason) {
        try {
            const key = `moderation:timed_roles:${guildId}`;
            const removals = await getFromDb(key, []);
            
            const removal = {
                id: Date.now(),
                userId,
                roleId,
                endsAt: Date.now() + durationMs,
                reason,
                status: 'active'
            };
            
            removals.push(removal);
            await setInDb(key, removals);
            
            logger.info(`Timed role removal recorded for user ${userId} in ${guildId}. Ends at: ${new Date(removal.endsAt).toISOString()}`);
            return { success: true, removal };
        } catch (error) {
            logger.error('Error adding timed role removal:', error);
            return { success: false, error: error.message };
        }
    }

    static async checkExpiredRemovals(client) {
        try {
            // This is a bit expensive if there are many guilds, but since we are guild-only/small scale it's okay.
            // A better way would be a global list or a more efficient DB query if using Postgres.
            // For now, we'll assume we can list keys or iterate guild caches.
            
            for (const [guildId, guild] of client.guilds.cache) {
                const key = `moderation:timed_roles:${guildId}`;
                const removals = await getFromDb(key, []);
                
                if (!Array.isArray(removals) || removals.length === 0) continue;
                
                const now = Date.now();
                const expired = removals.filter(r => r.status === 'active' && r.endsAt <= now);
                
                if (expired.length === 0) continue;
                
                for (const removal of expired) {
                    try {
                        const member = await guild.members.fetch(removal.userId).catch(() => null);
                        if (member) {
                            const role = guild.roles.cache.get(removal.roleId);
                            if (role) {
                                await member.roles.add(role, `Restoring role after temporary removal: ${removal.reason}`);
                                logger.info(`Restored role ${role.name} to user ${member.user.tag} in ${guild.name}`);
                            }
                        }
                        removal.status = 'restored';
                    } catch (err) {
                        logger.error(`Failed to restore role for removal ${removal.id}:`, err);
                    }
                }
                
                // Keep only non-expired or failed-but-marked-for-retry (actually just keep all but mark status)
                // To keep DB clean, maybe we remove restored ones after some time.
                const updatedRemovals = removals.filter(r => r.status !== 'restored');
                await setInDb(key, updatedRemovals);
            }
        } catch (error) {
            logger.error('Error checking expired timed roles:', error);
        }
    }
    static async isRemovalActive(guildId, userId, roleId) {
        try {
            const key = `moderation:timed_roles:${guildId}`;
            const removals = await getFromDb(key, []);
            
            const removal = removals.find(r => 
                r.userId === userId && 
                r.roleId === roleId && 
                r.status === 'active' && 
                r.endsAt > Date.now()
            );
            
            return !!removal;
        } catch (error) {
            logger.error('Error checking isRemovalActive:', error);
            return false;
        }
    }
}
