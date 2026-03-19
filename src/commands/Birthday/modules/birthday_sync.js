import { MessageFlags } from 'discord.js';
import { createEmbed, errorEmbed, successEmbed } from '../../../utils/embeds.js';
import { setBirthday, getGlobalBirthday } from '../../../utils/database.js';
import { logger } from '../../../utils/logger.js';
import { handleInteractionError } from '../../../utils/errorHandler.js';
import { InteractionHelper } from '../../../utils/interactionHelper.js';
import { getMonthName } from '../../../utils/database.js';

export default {
    /**
     * Executes the sync subcommand
     * Automatically fetches the user's birthday if set in another guild
     * @param {Interaction} interaction - The Discord interaction
     * @param {Object} config - Guild configuration
     * @param {Client} client - Discord client
     */
    async execute(interaction, config, client) {
        try {
            await InteractionHelper.safeDefer(interaction);

            const userId = interaction.user.id;
            const guildId = interaction.guildId;

            // 1. Fetch from global storage
            const globalData = await getGlobalBirthday(client, userId);
            
            if (!globalData) {
                return await InteractionHelper.safeEditReply(interaction, {
                    embeds: [errorEmbed(
                        "Birthday Not Found",
                        "I couldn't find your birthday in my records. Please use `/birthday set` to set it for the first time!"
                    )],
                    flags: MessageFlags.Ephemeral
                });
            }

            // 2. Sync to current guild
            const { month, day } = globalData;
            const success = await setBirthday(client, guildId, userId, month, day);

            if (!success) {
                throw new Error("Failed to sync birthday to the current server.");
            }

            await InteractionHelper.safeEditReply(interaction, {
                embeds: [successEmbed(
                    `Successfully fetched your birthday! It has been synced to this server as **${getMonthName(month)} ${day}**.`,
                    "Birthday Synced! 🔄"
                )]
            });

            logger.info('Birthday synced successfully via command', {
                userId,
                guildId,
                month,
                day
            });
        } catch (error) {
            logger.error("Birthday sync command execution failed", {
                error: error.message,
                userId: interaction.user.id,
                guildId: interaction.guildId
            });
            await handleInteractionError(interaction, error, {
                commandName: 'birthday_sync',
                source: 'birthday_sync_module'
            });
        }
    }
};
