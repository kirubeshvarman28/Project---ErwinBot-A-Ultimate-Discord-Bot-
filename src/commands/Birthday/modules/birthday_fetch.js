import { MessageFlags, PermissionFlagsBits } from 'discord.js';
import { createEmbed, errorEmbed, successEmbed } from '../../../utils/embeds.js';
import { getGlobalBirthday, getUserApplications, getApplicationKey, unwrapReplitData } from '../../../utils/database.js';
import { logger } from '../../../utils/logger.js';
import { handleInteractionError } from '../../../utils/errorHandler.js';
import { InteractionHelper } from '../../../utils/interactionHelper.js';
import { getMonthName } from '../../../utils/database.js';

export default {
    /**
     * Executes the fetch subcommand
     * Tries to find a user's DOB from global records and server applications
     * @param {Interaction} interaction - The Discord interaction
     * @param {Object} config - Guild configuration
     * @param {Client} client - Discord client
     */
    async execute(interaction, config, client) {
        try {
            await InteractionHelper.safeDefer(interaction);

            const targetUser = interaction.options.getUser("user");
            const userId = targetUser.id;
            const guildId = interaction.guildId;

            // 1. Permission Check: Only Admins can fetch for others
            if (userId !== interaction.user.id && !interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
                return await InteractionHelper.safeEditReply(interaction, {
                    embeds: [errorEmbed(
                        "Permission Denied",
                        "You need the `Manage Server` permission to fetch birthdays for other members."
                    )],
                    flags: MessageFlags.Ephemeral
                });
            }

            let foundBirthday = null;
            let source = "";

            // 2. Try to fetch from Global Storage first
            const globalData = await getGlobalBirthday(client, userId);
            if (globalData) {
                foundBirthday = globalData;
                source = "Global Records";
            }

            // 3. If not found, try to scrape Application System
            if (!foundBirthday) {
                const applicationIds = await getUserApplications(client, guildId, userId);
                const unwrappedIds = unwrapReplitData(applicationIds) || [];
                
                for (const appId of unwrappedIds) {
                    const appData = unwrapReplitData(await client.db.get(`guild:${guildId}:applications:${appId}`));
                    if (appData && appData.answers) {
                        for (const entry of appData.answers) {
                            const question = entry.question.toLowerCase();
                            const answer = entry.answer.toLowerCase();

                            // Search for DOB related keywords in questions
                            if (question.includes("age") || question.includes("dob") || question.includes("birthday") || question.includes("birth")) {
                                const parsed = this.parseDate(answer);
                                if (parsed) {
                                    foundBirthday = parsed;
                                    source = `Application (${entry.question})`;
                                    break;
                                }
                            }
                        }
                    }
                    if (foundBirthday) break;
                }
            }

            // 4. Handle results
            if (!foundBirthday) {
                return await InteractionHelper.safeEditReply(interaction, {
                    embeds: [errorEmbed(
                        "No Data Found",
                        `I couldn't find any birthday information for <@${userId}> in my database or past applications.\n\n*Note: Discord itself does not share user birthdays with bots for privacy reasons.*`
                    )]
                });
            }

            await InteractionHelper.safeEditReply(interaction, {
                embeds: [{
                    title: "🔍 Birthday Data Found!",
                    description: `I found a possible birthday for <@${userId}>:`,
                    color: 0x3498DB,
                    fields: [
                        { name: "Date", value: `**${getMonthName(foundBirthday.month)} ${foundBirthday.day}**`, inline: true },
                        { name: "Source", value: source, inline: true }
                    ],
                    footer: { text: "Use /birthday set to confirm this date if correct." },
                    timestamp: new Date()
                }]
            });

        } catch (error) {
            logger.error("Birthday fetch command execution failed", {
                error: error.message,
                userId: interaction.user.id,
                guildId: interaction.guildId
            });
            await handleInteractionError(interaction, error, {
                commandName: 'birthday_fetch',
                source: 'birthday_fetch_module'
            });
        }
    },

    /**
     * Simple date parser for common formats
     * Matches: "January 1", "Jan 1", "01/01", "01-01"
     * @param {string} text - The text to parse
     * @returns {Object|null} { month, day } or null
     */
    parseDate(text) {
        // 1. Match Month Name + Day (e.g., January 15)
        const monthNames = [
            "january", "february", "march", "april", "may", "june",
            "july", "august", "september", "october", "november", "december"
        ];
        const monthShorts = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

        for (let i = 0; i < 12; i++) {
            const mFull = monthNames[i];
            const mShort = monthShorts[i];
            const regex = new RegExp(`(${mFull}|${mShort})\\s+(\\d{1,2})`, "i");
            const match = text.match(regex);
            if (match) {
                const day = parseInt(match[2]);
                if (day >= 1 && day <= 31) return { month: i + 1, day };
            }
        }

        // 2. Match MM/DD or DD/MM (ambiguous, but we'll try MM/DD first for community bots)
        const slashRegex = /(\d{1,2})[\/\-](\d{1,2})/;
        const slashMatch = text.match(slashRegex);
        if (slashMatch) {
            let m = parseInt(slashMatch[1]);
            let d = parseInt(slashMatch[2]);
            if (m >= 1 && m <= 12 && d >= 1 && d <= 31) return { month: m, day: d };
            // Try swapping if invalid
            if (d >= 1 && d <= 12 && m >= 1 && m <= 31) return { month: d, day: m };
        }

        return null;
    }
};
