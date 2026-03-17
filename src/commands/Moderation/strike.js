import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { successEmbed, errorEmbed, warningEmbed } from '../../utils/embeds.js';
import { StrikeService } from '../../services/strikeService.js';

export default {
    data: new SlashCommandBuilder()
        .setName("strike")
        .setDescription("Give a strike to a user (3 strikes = action)")
        .addUserOption(option => 
            option.setName("target")
                .setDescription("The user to strike")
                .setRequired(true))
        .addStringOption(option => 
            option.setName("reason")
                .setDescription("Reason for the strike")
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
    category: "Moderation",

    async execute(interaction, guildConfig, client, args) {
        const moderator = interaction.user || interaction.author;
        const guildId = interaction.guildId;
        
        let target;
        let reason;

        if (interaction.options) {
            target = interaction.options.getUser("target");
            reason = interaction.options.getString("reason");
        } else {
            // Prefix command parsing: !strike @user reason
            const targetId = args[0]?.replace(/[<@!>]/g, '');
            target = client.users.cache.get(targetId);
            reason = args.slice(1).join(' ');
        }

        if (!target) {
            const embed = errorEmbed("Please mention a valid user to strike.");
            return interaction.reply ? await interaction.reply({ embeds: [embed], ephemeral: true }) : await interaction.channel.send({ embeds: [embed] });
        }

        if (!reason) {
            const embed = errorEmbed("Please provide a reason for the strike.");
            return interaction.reply ? await interaction.reply({ embeds: [embed], ephemeral: true }) : await interaction.channel.send({ embeds: [embed] });
        }

        const result = await StrikeService.addStrike(guildId, target.id, moderator.id, reason);

        if (result.success) {
            const embed = warningEmbed(
                `${target} has received a strike.\n**Reason:** ${reason}\n**Total Strikes:** ${result.strikeCount}\n**Action Taken:** ${result.actionTaken}`,
                `🚨 Strike Issued (${result.strikeCount}/3)`
            );
            return interaction.reply ? await interaction.reply({ embeds: [embed] }) : await interaction.channel.send({ embeds: [embed] });
        } else {
            const embed = errorEmbed("Failed to issue strike.");
            return interaction.reply ? await interaction.reply({ embeds: [embed], ephemeral: true }) : await interaction.channel.send({ embeds: [embed] });
        }
    }
};
