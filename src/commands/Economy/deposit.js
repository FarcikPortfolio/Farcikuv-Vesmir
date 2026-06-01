import { SlashCommandBuilder } from 'discord.js';
import { createEmbed, errorEmbed, successEmbed, infoEmbed, warningEmbed } from '../../utils/embeds.js';
import { getEconomyData, setEconomyData, getMaxBankCapacity } from '../../utils/economy.js';
import { withErrorHandling, createError, ErrorTypes } from '../../utils/errorHandler.js';
import { MessageTemplates } from '../../utils/messageTemplates.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

export default {
   data: new SlashCommandBuilder()
    .setName('deposit')
    .setDescription('Vložte peníze do banky. Použijte "all" pro vložení všeho.')
    .addStringOption(option =>
        option
            .setName('amount')
            .setDescription('Částka k vložení nebo "all"')
            .setRequired(true)
    ),

    execute: withErrorHandling(async (interaction, config, client) => {
        const deferred = await InteractionHelper.safeDefer(interaction);
        if (!deferred) return;
        
        const userId = interaction.user.id;
            const guildId = interaction.guildId;
            const amountInput = interaction.options.getString("amount");

            const userData = await getEconomyData(client, guildId, userId);
            
            if (!userData) {
                throw createError(
                    "Failed to load economy data",
                    ErrorTypes.DATABASE,
                    "Failed to load your economy data. Please try again later.",
                    { userId, guildId }
                );
            }
            
            const maxBank = getMaxBankCapacity(userData);
            let depositAmount;

            if (amountInput.toLowerCase() === "all") {
                depositAmount = userData.wallet;
            } else {
                depositAmount = parseInt(amountInput);

                if (isNaN(depositAmount) || depositAmount <= 0) {
                    throw createError(
                        "Neplatná částka k vložení",
                        ErrorTypes.VALIDATION,
                        `Prosím zadejte platné číslo nebo 'all'. Zadali jste: \`${amountInput}\``,
                        { amountInput, userId }
                    );
                }
            }

            if (depositAmount === 0) {
                throw createError(
                    "Nulová částka k vložení",
                    ErrorTypes.VALIDATION,
                    "Nemáte žádné peníze k vložení.",
                    { userId, walletBalance: userData.wallet }
                );
            }

            if (depositAmount > userData.wallet) {
                depositAmount = userData.wallet;
                await interaction.followUp({
                    embeds: [
                        MessageTemplates.ERRORS.INVALID_INPUT(
                            "částka k vložení",
                            `Pokusili jste se vložit více peněz, než máte. Vkládání zbývajícího zůstatku: **$${depositAmount.toLocaleString()}**`
                        )
                    ],
                    flags: ["Ephemeral"],
                });
            }

            const availableSpace = maxBank - userData.bank;

            if (availableSpace <= 0) {
                throw createError(
                    "Banka je plná",
                    ErrorTypes.VALIDATION,
                    `Vaše banka je aktuálně plná (Maximální kapacita: $${maxBank.toLocaleString()}). Koupě **Vylepšení banky** zvýší váš limit.`,
                    { maxBank, currentBank: userData.bank, userId }
                );
            }

            if (depositAmount > availableSpace) {
                const originalDepositAmount = depositAmount;
                depositAmount = availableSpace;

                if (amountInput.toLowerCase() !== "all") {
                    await interaction.followUp({
                        embeds: [
                            MessageTemplates.ERRORS.INVALID_INPUT(
                                "částka k vložení",
                                `Pokusili jste se vložit více peněz, než máte. Vkládání zbývajícího zůstatku: **$${depositAmount.toLocaleString()}**`
                            )
                        ],
                        flags: ["Ephemeral"],
                    });
                }
            }

            if (depositAmount === 0) {
                throw createError(
                    "Žádné peníze k vložení",
                    ErrorTypes.VALIDATION,
                    "Množství, které se pokoušíte vložit, je 0 nebo překračuje kapacitu vaší banky. Prosím zadejte platnou částku k vložení.",
                    { depositAmount, availableSpace, walletBalance: userData.wallet }
                );
            }

            userData.wallet -= depositAmount;
            userData.bank += depositAmount;

            await setEconomyData(client, guildId, userId, userData);

            const embed = MessageTemplates.SUCCESS.DATA_UPDATED(
                "deposit",
                `Úspěšně jste vložili **$${depositAmount.toLocaleString()}** do své banky.`
            )
                .addFields(
                    {
                        name: "💵 Nový zůstatek v peněžence",
                        value: `$${userData.wallet.toLocaleString()}`,
                        inline: true,
                    },
                    {
                        name: "🏦 Nový zůstatek v bance",
                        value: `$${userData.bank.toLocaleString()} / $${maxBank.toLocaleString()}`,
                        inline: true,
                    },
                );

            await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
    }, { command: 'deposit' })
};





