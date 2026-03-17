import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { successEmbed, errorEmbed } from '../../utils/embeds.js';

export default {
    data: new SlashCommandBuilder()
        .setName("lockchat")
        .setDescription("Lock the channel during trading hours")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
    category: "Moderation",

    async execute(interaction) {
        const channel = interaction.channel;
        const guild = interaction.guild;
        const everyoneRole = guild.roles.everyone;

        try {
            await channel.permissionOverwrites.edit(everyoneRole, {
                SendMessages: false
            }, { reason: "Trading hours lockdown" });

            const embed = successEmbed(
                "This channel is now locked for trading hours. No spam, only serious discussion or silence.",
                "🚨 Trading Hours - Channel Locked"
            );

            return interaction.reply ? await interaction.reply({ embeds: [embed] }) : await interaction.channel.send({ embeds: [embed] });
        } catch (error) {
            const embed = errorEmbed("Failed to lock the channel. Check my permissions.");
            return interaction.reply ? await interaction.reply({ embeds: [embed], ephemeral: true }) : await interaction.channel.send({ embeds: [embed] });
        }
    }
};
