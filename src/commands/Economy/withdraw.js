import { SlashCommandBuilder } from 'discord.js';
import { createEmbed, errorEmbed, successEmbed, infoEmbed, warningEmbed } from '../../utils/embeds.js';
import { getEconomyData, setEconomyData, getMaxBankCapacity } from '../../utils/economy.js';
import { withErrorHandling, createError, ErrorTypes } from '../../utils/errorHandler.js';
import { MessageTemplates } from '../../utils/messageTemplates.js';

import { InteractionHelper } from '../../utils/interactionHelper.js';
export default {
    data: new SlashCommandBuilder()
        .setName('withdraw')
        .setDescription('Vyberte peníze z banky a vložte je do peněženky.')
        .addIntegerOption(option =>
            option
                .setName('amount')
                .setDescription('Částka k výběru')
                .setRequired(true)
                .setMinValue(1)
        ),

    execute: withErrorHandling(async (interaction, config, client) => {
        await InteractionHelper.safeDefer(interaction);
            
            const userId = interaction.user.id;
            const guildId = interaction.guildId;
            const amountInput = interaction.options.getInteger("amount");

            const userData = await getEconomyData(client, guildId, userId);
            
            if (!userData) {
                throw createError(
                    "Selhání při načítání ekonomických dat",
                    ErrorTypes.DATABASE,
                    "Selhání při načítání ekonomických dat. Prosím zkuste to později.",
                    { userId, guildId }
                );
            }

            let withdrawAmount = amountInput;

            if (withdrawAmount <= 0) {
                throw createError(
                    "Neplatná částka k výběru",
                    ErrorTypes.VALIDATION,
                    "Musíte vybrat platnou částku.",
                    { amount: withdrawAmount, userId }
                );
            }

            if (withdrawAmount > userData.bank) {
                withdrawAmount = userData.bank;
            }

            if (withdrawAmount === 0) {
                throw createError(
                    "Prázdný účet v bance",
                    ErrorTypes.VALIDATION,
                    "Váš účet v bance je prázdný.",
                    { userId, bankBalance: userData.bank }
                );
            }

            userData.wallet += withdrawAmount;
            userData.bank -= withdrawAmount;

            await setEconomyData(client, guildId, userId, userData);

            const embed = MessageTemplates.SUCCESS.DATA_UPDATED(
                "withdrawal",
                `Úspěšně jste vybrali **$${withdrawAmount.toLocaleString()}** z vaší banky.`
            )
                .addFields(
                    {
                        name: "💵 Nový zůstatek v peněžence",
                        value: `$${userData.wallet.toLocaleString()}`,
                        inline: true,
                    },
                    {
                        name: "🏦 Nový zůstatek v bance",
                        value: `$${userData.bank.toLocaleString()}`,
                        inline: true,
                    },
                );

            await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
    }, { command: 'withdraw' })
};