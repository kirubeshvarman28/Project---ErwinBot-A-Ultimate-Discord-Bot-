import { SlashCommandBuilder } from 'discord.js';
import { infoEmbed } from '../../utils/embeds.js';
import { TradingService } from '../../services/tradingService.js';

export default {
    data: new SlashCommandBuilder()
        .setName("checklist")
        .setDescription("Entry checklist before trade"),
    category: "Trading",

    async execute(interaction) {
        const checklist = TradingService.getChecklist();
        const checklistContent = checklist.join('\n');

        const embed = infoEmbed(
            checklistContent,
            "✅ Pre-Trade Checklist"
        );

        if (interaction.reply) {
            await interaction.reply({ embeds: [embed] });
        } else {
            await interaction.channel.send({ embeds: [embed] });
        }
    }
};
