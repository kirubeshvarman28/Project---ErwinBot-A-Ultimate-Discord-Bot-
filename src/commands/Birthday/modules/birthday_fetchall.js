import { MessageFlags, PermissionFlagsBits } from 'discord.js';
import { createEmbed, errorEmbed, successEmbed } from '../../../utils/embeds.js';
import { getGuildBirthdays, unwrapReplitData, setBirthday, getMonthName } from '../../../utils/database.js';
import { logger } from '../../../utils/logger.js';
import { handleInteractionError } from '../../../utils/errorHandler.js';
import { InteractionHelper } from '../../../utils/interactionHelper.js';
import birthdayFetch from './birthday_fetch.js';

export default {
    /**
     * Executes the fetchall subcommand (Admin only)
     * Scrapes all server applications for birthday data
     * @param {Interaction} interaction - The Discord interaction
     * @param {Object} config - Guild configuration
     * @param {Client} client - Discord client
     */
    async execute(interaction, config, client) {
        try {
            // 1. Permission Check
            if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
                return await InteractionHelper.safeReply(interaction, {
                    embeds: [errorEmbed(
                        "Permission Denied",
                        "You need the `Manage Server` permission to run a bulk fetch."
                    )],
                    flags: MessageFlags.Ephemeral
                });
            }

            await InteractionHelper.safeDefer(interaction);

            const guildId = interaction.guildId;
            const prefix = `guild:${guildId}:applications:users:`;
            
            // 2. List all users who have submitted applications
            let userKeys = await client.db.list(prefix);
            if (!Array.isArray(userKeys)) {
                if (typeof userKeys === 'object' && userKeys !== null) {
                    userKeys = Object.keys(userKeys).filter(key => key.startsWith(prefix));
                } else {
                    userKeys = [];
                }
            }

            if (userKeys.length === 0) {
                return await InteractionHelper.safeEditReply(interaction, {
                    embeds: [errorEmbed("No Applications", "No application data found in this server to scrape.")]
                });
            }

            const results = [];
            let foundCount = 0;

            // 3. Process each user's applications
            for (const key of userKeys) {
                const userId = key.replace(prefix, '');
                
                // Skip if they already have a birthday set in this guild
                const existing = await getGuildBirthdays(client, guildId);
                if (existing[userId]) continue;

                // Scrape their applications
                const applicationIds = unwrapReplitData(await client.db.get(key)) || [];
                let foundForUser = null;

                for (const appId of applicationIds) {
                    const appData = unwrapReplitData(await client.db.get(`guild:${guildId}:applications:${appId}`));
                    if (appData && appData.answers) {
                        for (const entry of appData.answers) {
                            const question = entry.question.toLowerCase();
                            const answer = entry.answer.toLowerCase();

                            if (question.includes("age") || question.includes("dob") || question.includes("birthday") || question.includes("birth")) {
                                const parsed = birthdayFetch.parseDate(answer);
                                if (parsed) {
                                    foundForUser = parsed;
                                    break;
                                }
                            }
                        }
                    }
                    if (foundForUser) break;
                }

                if (foundForUser) {
                    results.push({ userId, ...foundForUser });
                    foundCount++;
                }
            }

            // 4. Report Results
            if (foundCount === 0) {
                return await InteractionHelper.safeEditReply(interaction, {
                    embeds: [successEmbed("Scrape Completed", "I scanned all applications but couldn't find any new birthday data.")]
                });
            }

            const resultList = results.map(r => `<@${r.userId}>: ${getMonthName(r.month)} ${r.day}`).join('\n');
            
            await InteractionHelper.safeEditReply(interaction, {
                embeds: [{
                    title: "✅ Bulk Fetch Completed",
                    description: `I found **${foundCount}** potential birthday entries from past applications!\n\nNote: These have NOT been set automatically. Admins should verify and use \`/birthday set\` to confirm them.\n\n${resultList.substring(0, 3800)}`,
                    color: 0x57F287,
                    footer: { text: "Use /birthday set user:[user] to confirm these dates." },
                    timestamp: new Date()
                }]
            });

            logger.info('Bulk birthday fetch completed', {
                guildId,
                foundCount,
                scannedCount: userKeys.length
            });

        } catch (error) {
            logger.error("Birthday fetchall command execution failed", {
                error: error.message,
                userId: interaction.user.id,
                guildId: interaction.guildId
            });
            await handleInteractionError(interaction, error, {
                commandName: 'birthday_fetchall',
                source: 'birthday_fetchall_module'
            });
        }
    }
};
