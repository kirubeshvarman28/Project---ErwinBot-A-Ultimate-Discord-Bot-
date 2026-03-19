import { MessageFlags, PermissionFlagsBits } from 'discord.js';
import { createEmbed, errorEmbed, successEmbed } from '../../../utils/embeds.js';
import { getGuildConfig, setGuildConfig } from '../../../utils/database.js';
import { logger } from '../../../utils/logger.js';
import { handleInteractionError } from '../../../utils/errorHandler.js';
import { InteractionHelper } from '../../../utils/interactionHelper.js';

export default {
    /**
     * Executes the setup subcommand (Admin only)
     * Configures the birthday announcement channel and optional role
     * @param {Interaction} interaction - The Discord interaction
     * @param {Object} config - Guild configuration
     * @param {Client} client - Discord client
     */
    async execute(interaction, config, client) {
        try {
            // Check for ManageGuild permission
            if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
                return await InteractionHelper.safeReply(interaction, {
                    embeds: [errorEmbed(
                        "Permission Denied",
                        "You need the `Manage Server` permission to use this command."
                    )],
                    flags: MessageFlags.Ephemeral
                });
            }

            await InteractionHelper.safeDefer(interaction);

            const channel = interaction.options.getChannel("channel");
            const role = interaction.options.getRole("role");
            const guildId = interaction.guildId;

            // 1. Fetch current config
            const currentConfig = await getGuildConfig(client, guildId);
            
            // 2. Prepare updates
            const updates = {
                ...currentConfig,
                birthdayChannelId: channel.id,
                birthdayEnabled: true
            };

            if (role) {
                updates.birthdayRoleId = role.id;
            }

            // 3. Save to database
            const success = await setGuildConfig(client, guildId, updates);

            if (!success) {
                throw new Error("Failed to save birthday configuration.");
            }

            // 4. Send success message
            const fields = [
                { name: "Announcement Channel", value: `<#${channel.id}>`, inline: true }
            ];
            
            if (role) {
                fields.push({ name: "Birthday Role", value: `<@&${role.id}>`, inline: true });
            }

            await InteractionHelper.safeEditReply(interaction, {
                embeds: [{
                    title: "✅ Birthday System Configured!",
                    description: "The birthday system has been successfully set up for this server. I will now automatically announce birthdays here!",
                    color: 0x57F287, // Success Green
                    fields,
                    footer: { text: "Erwin Birthday System" },
                    timestamp: new Date()
                }]
            });

            logger.info('Birthday system setup completed', {
                guildId,
                channelId: channel.id,
                roleId: role?.id,
                userId: interaction.user.id
            });
        } catch (error) {
            logger.error("Birthday setup command execution failed", {
                error: error.message,
                userId: interaction.user.id,
                guildId: interaction.guildId
            });
            await handleInteractionError(interaction, error, {
                commandName: 'birthday_setup',
                source: 'birthday_setup_module'
            });
        }
    }
};
