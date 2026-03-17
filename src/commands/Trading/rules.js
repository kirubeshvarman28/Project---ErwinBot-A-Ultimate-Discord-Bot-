import { SlashCommandBuilder } from 'discord.js';
import { successEmbed } from '../../utils/embeds.js';
import { TradingService } from '../../services/tradingService.js';

export default {
    data: new SlashCommandBuilder()
        .setName("rules")
        .setDescription("Displays trading rules"),
    category: "Trading",

    async execute(interaction) {
        const rules = TradingService.getRules();
        const ruleList = rules.join('\n');

        const embed = successEmbed(
            ruleList,
            "📜 Trading Discipline Rules"
        );

        if (interaction.reply) {
            await interaction.reply({ embeds: [embed] });
        } else {
            // Prefix command support
            await interaction.channel.send({ embeds: [embed] });
        }
    }
};
