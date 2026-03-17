import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { successEmbed, errorEmbed, warningEmbed } from '../../utils/embeds.js';
import { TimedRoleService } from '../../services/timedRoleService.js';
import { ModerationService } from '../../services/moderationService.js';

const durationChoices = [
    { name: "5 minutes", value: 5 },
    { name: "10 minutes", value: 10 },
    { name: "30 minutes", value: 30 },
    { name: "1 hour", value: 60 },
    { name: "6 hours", value: 360 },
    { name: "1 day", value: 1440 },
    { name: "3 days", value: 4320 },
    { name: "1 week", value: 10080 },
];

export default {
    data: new SlashCommandBuilder()
        .setName("removerole")
        .setDescription("Remove a role from a member for a specific duration.")
        .addUserOption(option => 
            option.setName("target")
                .setDescription("The user to remove role from")
                .setRequired(true))
        .addRoleOption(option => 
            option.setName("role")
                .setDescription("The role to remove")
                .setRequired(true))
        .addIntegerOption(option => 
            option.setName("duration")
                .setDescription("Duration of the removal")
                .setRequired(true)
                .addChoices(...durationChoices))
        .addStringOption(option => 
            option.setName("reason")
                .setDescription("Reason for the removal")
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
    category: "Moderation",

    async execute(interaction, guildConfig, client, args) {
        const moderator = interaction.member || (interaction.author ? await interaction.guild.members.fetch(interaction.author.id) : null);
        const guildId = interaction.guildId;
        
        let targetMember;
        let role;
        let durationMinutes;
        let reason;

        if (interaction.options) {
            targetMember = interaction.options.getMember("target");
            role = interaction.options.getRole("role");
            durationMinutes = interaction.options.getInteger("duration");
            reason = interaction.options.getString("reason");
        } else {
            // Prefix command support: !removerole @user @role 10m reason
            // This is a bit more complex to parse perfectly but let's try basic
            const targetId = args[0]?.replace(/[<@!>]/g, '');
            targetMember = await interaction.guild.members.fetch(targetId).catch(() => null);
            
            const roleId = args[1]?.replace(/[<@&>]/g, '');
            role = interaction.guild.roles.cache.get(roleId);
            
            const durationStr = args[2];
            // Simple duration parser for prefix
            if (durationStr?.endsWith('m')) durationMinutes = parseInt(durationStr);
            else if (durationStr?.endsWith('h')) durationMinutes = parseInt(durationStr) * 60;
            else if (durationStr?.endsWith('d')) durationMinutes = parseInt(durationStr) * 1440;
            else durationMinutes = parseInt(durationStr);

            reason = args.slice(3).join(' ');
        }

        if (!targetMember || !role || !durationMinutes || !reason) {
            const embed = errorEmbed("Invalid arguments. Use `/removerole target role duration reason` or `!removerole @user @role 10m reason`.");
            return interaction.reply ? await interaction.reply({ embeds: [embed], ephemeral: true }) : await interaction.channel.send({ embeds: [embed] });
        }

        // Hierarchy Checks
        const botCheck = ModerationService.validateBotHierarchy(client, targetMember, 'modify');
        if (!botCheck.valid) {
            const embed = errorEmbed(botCheck.error);
            return interaction.reply ? await interaction.reply({ embeds: [embed], ephemeral: true }) : await interaction.channel.send({ embeds: [embed] });
        }

        const modCheck = ModerationService.validateHierarchy(moderator, targetMember, 'modify');
        if (!modCheck.valid) {
            const embed = errorEmbed(modCheck.error);
            return interaction.reply ? await interaction.reply({ embeds: [embed], ephemeral: true }) : await interaction.channel.send({ embeds: [embed] });
        }

        if (role.position >= moderator.roles.highest.position && interaction.guild.ownerId !== moderator.id) {
            const embed = errorEmbed("You cannot remove a role that is equal to or higher than your own.");
            return interaction.reply ? await interaction.reply({ embeds: [embed], ephemeral: true }) : await interaction.channel.send({ embeds: [embed] });
        }

        try {
            if (!targetMember.roles.cache.has(role.id)) {
                const embed = errorEmbed(`${targetMember} does not have the ${role} role.`);
                return interaction.reply ? await interaction.reply({ embeds: [embed], ephemeral: true }) : await interaction.channel.send({ embeds: [embed] });
            }

            await targetMember.roles.remove(role, `Temporary removal by ${moderator.user.tag}: ${reason}`);
            
            const durationMs = durationMinutes * 60 * 1000;
            const result = await TimedRoleService.addRemoval(guildId, targetMember.id, role.id, durationMs, reason);

            if (result.success) {
                const durationDisplay = durationChoices.find(c => c.value === durationMinutes)?.name || `${durationMinutes}m`;
                
                // DM the user with strict enforcement note and countdown
                const restorationTime = Math.floor((Date.now() + durationMs) / 1000);
                const dmEmbed = warningEmbed(
                    `Your **${role.name}** role has been removed in **${interaction.guild.name}**.\n\n**Reason:** ${reason}\n**Restoration:** Your role will be restored **<t:${restorationTime}:R>**.\n\n*Note: This is strictly enforced. Manual restoration before the timer ends will be automatically reverted.*`,
                    "⏳ Role Removal Notification"
                );

                try {
                    await targetMember.send({ embeds: [dmEmbed] }).catch(() => null);
                } catch (dmErr) {
                    logger.debug(`Could not DM user ${targetMember.id}`);
                }

                const embed = successEmbed(
                    `${role} has been removed from ${targetMember} for **${durationDisplay}**.\n**Reason:** ${reason}\n**Restoration:** <t:${restorationTime}:R>`,
                    "⏳ Timed Role Removal"
                );
                return interaction.reply ? await interaction.reply({ embeds: [embed] }) : await interaction.channel.send({ embeds: [embed] });
            } else {
                // Rollback if DB failed
                await targetMember.roles.add(role, "Rollback: Failed to record removal in database");
                throw new Error(result.error);
            }
        } catch (error) {
            logger.error('removerole command error:', error);
            const embed = errorEmbed("An error occurred while removing the role. Check my permissions.");
            return interaction.reply ? await interaction.reply({ embeds: [embed], ephemeral: true }) : await interaction.channel.send({ embeds: [embed] });
        }
    }
};
