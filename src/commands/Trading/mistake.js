import { SlashCommandBuilder } from 'discord.js';
import { successEmbed, errorEmbed, infoEmbed } from '../../utils/embeds.js';
import { TradingService } from '../../services/tradingService.js';

export default {
    data: new SlashCommandBuilder()
        .setName("mistake")
        .setDescription("Log your trading mistake")
        .addStringOption(option => 
            option.setName("reason")
                .setDescription("What was the mistake?")
                .setRequired(true)),
    category: "Trading",

    async execute(interaction, guildConfig, client, args) {
        const guildId = interaction.guildId;
        const userId = interaction.user ? interaction.user.id : interaction.author.id;
        const reason = interaction.options ? interaction.options.getString("reason") : args.join(' ');

        if (!reason || reason.trim().length === 0) {
            const embed = errorEmbed("Please provide a reason for the mistake.");
            return interaction.reply ? await interaction.reply({ embeds: [embed], ephemeral: true }) : await interaction.channel.send({ embeds: [embed] });
        }

        const result = await TradingService.logMistake(guildId, userId, reason);

        if (result.success) {
            const embed = successEmbed(
                `Your mistake has been logged: **${reason}**\nLearn from it and stay disciplined!`,
                "⚠️ Mistake Logged"
            );
            return interaction.reply ? await interaction.reply({ embeds: [embed] }) : await interaction.channel.send({ embeds: [embed] });
        } else {
            const embed = errorEmbed("Failed to log mistake. Please try again later.");
            return interaction.reply ? await interaction.reply({ embeds: [embed], ephemeral: true }) : await interaction.channel.send({ embeds: [embed] });
        }
    }
};
