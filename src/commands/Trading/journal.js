import { SlashCommandBuilder } from 'discord.js';
import { infoEmbed, successEmbed, errorEmbed } from '../../utils/embeds.js';
import { TradingService } from '../../services/tradingService.js';

export default {
    data: new SlashCommandBuilder()
        .setName("journal")
        .setDescription("Daily trade journal reminder/log")
        .addStringOption(option => 
            option.setName("content")
                .setDescription("Your journal entry for today")
                .setRequired(false)),
    category: "Trading",

    async execute(interaction, guildConfig, client, args) {
        const guildId = interaction.guildId;
        const user = interaction.user || interaction.author;
        const content = interaction.options ? interaction.options.getString("content") : args.join(' ');

        if (!content) {
            const embed = infoEmbed(
                "Don't forget to journal your trades today! Use `!journal <entry>` to log your progress.",
                "📑 Daily Journal Reminder"
            );
            return interaction.reply ? await interaction.reply({ embeds: [embed] }) : await interaction.channel.send({ embeds: [embed] });
        }

        const result = await TradingService.logJournal(guildId, user.id, content);

        if (result.success) {
            const embed = successEmbed(
                "Your journal entry has been saved successfully.",
                "📑 Journal Entry Saved"
            );
            return interaction.reply ? await interaction.reply({ embeds: [embed] }) : await interaction.channel.send({ embeds: [embed] });
        } else {
            const embed = errorEmbed("Failed to save journal entry.");
            return interaction.reply ? await interaction.reply({ embeds: [embed], ephemeral: true }) : await interaction.channel.send({ embeds: [embed] });
        }
    }
};
