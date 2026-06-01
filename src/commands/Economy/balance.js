import { SlashCommandBuilder } from 'discord.js';
import { createEmbed, errorEmbed, successEmbed, infoEmbed, warningEmbed } from '../../utils/embeds.js';
import { getEconomyData, getMaxBankCapacity } from '../../utils/economy.js';
import { withErrorHandling, createError, ErrorTypes } from '../../utils/errorHandler.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

export default {
    data: new SlashCommandBuilder()
        .setName('balance')
        .setDescription("Zobrazí zůstatek peněženky a banky.")
        .addUserOption(option =>
            option
                .setName('user')
                .setDescription('Uživatel, jehož zůstatek chcete zobrazit')
                .setRequired(false)
        ),

    execute: withErrorHandling(async (interaction, config, client) => {
        const deferred = await InteractionHelper.safeDefer(interaction);
        if (!deferred) return;
            
            const targetUser = interaction.options.getUser("user") || interaction.user;
            const guildId = interaction.guildId;

            logger.debug(`[ECONOMY] Kontrola zůstatku pro ${targetUser.id}`, { userId: targetUser.id, guildId });

            if (targetUser.bot) {
                throw createError(
                    "Selhání při kontrole zůstatku pro bot uživatele",
                    ErrorTypes.VALIDATION,
                    "Boti nemají ekonomický zůstatek."
                );
            }

            const userData = await getEconomyData(client, guildId, targetUser.id);
            
            if (!userData) {
                throw createError(
                    "Selhání při načítání ekonomických dat uživatele",
                    ErrorTypes.DATABASE,
                    "Selhání při načítání ekonomických dat uživatele. Prosím zkuste to později.",
                    { userId: targetUser.id, guildId }
                );
            }

            const maxBank = getMaxBankCapacity(userData);

            const wallet = typeof userData.wallet === 'number' ? userData.wallet : 0;
            const bank = typeof userData.bank === 'number' ? userData.bank : 0;

            const embed = createEmbed({
                title: `💰 ${targetUser.username}'s Balance`,
                description: `Tady je tvůj aktuální finanční stav ${targetUser.username}.`,
            })
                .addFields(
                    {
                        name: "💵 Peníze",
                        value: `$${wallet.toLocaleString()}`,
                        inline: true,
                    },
                    {
                        name: "🏦 Banka",
                        value: `$${bank.toLocaleString()} / $${maxBank.toLocaleString()}`,
                        inline: true,
                    },
                    {
                        name: "💎 Celkem",
                        value: `$${(wallet + bank).toLocaleString()}`,
                        inline: true,
                    }
                )
                .setFooter({
                    text: `Requested by ${interaction.user.tag}`,
                    iconURL: interaction.user.displayAvatarURL(),
                });

            logger.info(`[ECONOMY] Zůstatek načten`, { userId: targetUser.id, wallet, bank });

            await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
    }, { command: 'balance' })
};




