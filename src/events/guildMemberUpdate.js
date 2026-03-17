import { TimedRoleService } from '../services/timedRoleService.js';
import { logger } from '../utils/logger.js';
import { errorEmbed } from '../utils/embeds.js';

export default {
    name: 'guildMemberUpdate',
    async execute(oldMember, newMember) {
        // Only run if roles were changed
        if (oldMember.roles.cache.size >= newMember.roles.cache.size) return;

        const guildId = newMember.guild.id;
        const userId = newMember.id;
        
        // Find newly added roles
        const addedRoles = newMember.roles.cache.filter(role => !oldMember.roles.cache.has(role.id));
        
        for (const [roleId, role] of addedRoles) {
            const isActive = await TimedRoleService.isRemovalActive(guildId, userId, roleId);
            
            if (isActive) {
                try {
                    // Strict Enforcement: Remove the role immediately
                    await newMember.roles.remove(role, "Strict Enforcement: User is under a timed role removal period.");
                    
                    logger.info(`Strict Enforcement triggered: Role ${role.name} removed from ${newMember.user.tag} in ${newMember.guild.name}`);
                    
                    // Optional: Notify the user or log to a channel
                    try {
                        await newMember.send({
                            embeds: [errorEmbed(`You cannot have the **${role.name}** role restored yet. Your timed removal period has not expired.`)]
                        }).catch(() => null);
                    } catch (dmErr) {
                        // Ignore DM errors
                    }
                } catch (err) {
                    logger.error(`Failed to enforce strict role removal for ${role.name} on ${newMember.user.tag}:`, err);
                }
            }
        }
    }
};
