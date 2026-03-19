import { MessageFlags, PermissionFlagsBits } from 'discord.js';
import { createEmbed, errorEmbed, successEmbed } from '../../../utils/embeds.js';
import { setBirthday } from '../../../services/birthdayService.js';
import { logger } from '../../../utils/logger.js';
import { handleInteractionError } from '../../../utils/errorHandler.js';

import { InteractionHelper } from '../../../utils/interactionHelper.js';
export default {
    async execute(interaction, config, client) {
        try {
            await InteractionHelper.safeDefer(interaction);

            const month = interaction.options.getInteger("month");
            const day = interaction.options.getInteger("day");
            const targetUser = interaction.options.getUser("user") || interaction.user;
            const userId = targetUser.id;
            const guildId = interaction.guildId;

            // 1. Permission Check: Only Admins can set birthdays for others
            if (userId !== interaction.user.id && !interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
                return await InteractionHelper.safeEditReply(interaction, {
                    embeds: [errorEmbed(
                        "Permission Denied",
                        "You need the `Manage Server` permission to set birthdays for other members."
                    )],
                    flags: MessageFlags.Ephemeral
                });
            }

            // 2. Set Birthday in Database
            const result = await setBirthday(client, guildId, userId, month, day);
            
            const targetMention = userId === interaction.user.id ? "Your" : `<@${userId}>'s`;
            await InteractionHelper.safeEditReply(interaction, {
                embeds: [successEmbed(
                    `${targetMention} birthday has been set to **${result.data.monthName} ${result.data.day}**!`,
                    "Birthday Updated! 🎂"
                )]
            });
        } catch (error) {
            logger.error("Birthday set command execution failed", {
                error: error.message,
                stack: error.stack,
                userId: interaction.user.id,
                guildId: interaction.guildId,
                commandName: 'birthday_set'
            });
            await handleInteractionError(interaction, error, {
                commandName: 'birthday_set',
                source: 'birthday_set_module'
            });
        }
    }
};



