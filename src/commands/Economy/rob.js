import { SlashCommandBuilder } from 'discord.js';
import { createEmbed, errorEmbed, successEmbed, infoEmbed, warningEmbed } from '../../utils/embeds.js';
import { getEconomyData, setEconomyData } from '../../utils/economy.js';
import { withErrorHandling, createError, ErrorTypes } from '../../utils/errorHandler.js';
import { MessageTemplates } from '../../utils/messageTemplates.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

const ROB_COOLDOWN = 4 * 60 * 60 * 1000;
const BASE_ROB_SUCCESS_CHANCE = 0.25;
const ROB_PERCENTAGE = 0.15;
const FINE_PERCENTAGE = 0.1;

export default {
    data: new SlashCommandBuilder()
        .setName('rob')
        .setDescription('Pokus se okrást jiného uživatele.')
        .addUserOption(option =>
            option
                .setName('user')
                .setDescription('Uživatel, kterého chcete okrást')
                .setRequired(true)
        ),

    execute: withErrorHandling(async (interaction, config, client) => {
        const deferred = await InteractionHelper.safeDefer(interaction);
        if (!deferred) return;
            
            const robberId = interaction.user.id;
            const victimUser = interaction.options.getUser("user");
            const guildId = interaction.guildId;
            const now = Date.now();

            if (robberId === victimUser.id) {
                throw createError(
                    "Nelze okrást sám sebe",
                    ErrorTypes.VALIDATION,
                    "Nemůžete okrást sám sebe.",
                    { robberId, victimId: victimUser.id }
                );
            }
            
            if (victimUser.bot) {
                throw createError(
                    "Nelze okrást bota",
                    ErrorTypes.VALIDATION,
                    "Nemůžete okrást bota.",
                    { victimId: victimUser.id, isBot: true }
                );
            }

            const robberData = await getEconomyData(client, guildId, robberId);
            const victimData = await getEconomyData(client, guildId, victimUser.id);
            
            if (!robberData || !victimData) {
                throw createError(
                    "Selhání při načítání ekonomických dat",
                    ErrorTypes.DATABASE,
                    "Selhání při načítání ekonomických dat. Prosím zkuste to později.",
                    { robberId: !!robberData, victimId: !!victimData, guildId }
                );
            }
            
            const lastRob = robberData.lastRob || 0;

            if (now < lastRob + ROB_COOLDOWN) {
                const remaining = lastRob + ROB_COOLDOWN - now;
                const hours = Math.floor(remaining / (1000 * 60 * 60));
                const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));

                throw createError(
                    "Doba pro loupež je aktivní",
                    ErrorTypes.RATE_LIMIT,
                    `Musíte počkat. Počkejte **${hours}h ${minutes}m** před dalším pokusem o loupež.`,
                    { remaining, hours, minutes, cooldownType: 'rob' }
                );
            }

            if (victimData.wallet < 500) {
                throw createError(
                    "Oběť je příliš chudá",
                    ErrorTypes.VALIDATION,
                    `${victimUser.username} je příliš chudý. Potřebuje alespoň $500 v hotovosti, aby byl možný okrást.`,
                    { victimWallet: victimData.wallet, required: 500 }
                );
            }

            const hasSafe = victimData.inventory["personal_safe"] || 0;

            if (hasSafe > 0) {
                robberData.lastRob = now;
                await setEconomyData(client, guildId, robberId, robberData);

                return await InteractionHelper.safeEditReply(interaction, {
                    embeds: [
                        MessageTemplates.ERRORS.CONFIGURATION_REQUIRED(
                            "Ochrana proti loupeži aktivní",
                            `${victimUser.username} Byl připraven! Váš pokus o loupež selhal, protože měl v inventáři osobní trezor. Počkejte 4 hodiny před dalším pokusem o loupež tohoto uživatele.`
                        )
                    ],
                });
            }

            const isSuccessful = Math.random() < BASE_ROB_SUCCESS_CHANCE;
            let resultEmbed;

            if (isSuccessful) {
                const amountStolen = Math.floor(victimData.wallet * ROB_PERCENTAGE);

                robberData.wallet = (robberData.wallet || 0) + amountStolen;
                victimData.wallet = (victimData.wallet || 0) - amountStolen;

                resultEmbed = MessageTemplates.SUCCESS.DATA_UPDATED(
                    "robbery",
                    `Úspěšně jste ukradl **$${amountStolen.toLocaleString()}** od ${victimUser.username}!`
                );
            } else {
                const fineAmount = Math.floor((robberData.wallet || 0) * FINE_PERCENTAGE);

                if ((robberData.wallet || 0) < fineAmount) {
                    robberData.wallet = 0;
                } else {
                    robberData.wallet = (robberData.wallet || 0) - fineAmount;
                }

                resultEmbed = MessageTemplates.ERRORS.INSUFFICIENT_PERMISSIONS(
                    "robbery failed",
                    `Váš pokus o loupež selhal a byl jsi chycen! Byl jste potrestán **$${fineAmount.toLocaleString()}** z vašeho vlastního hotovosti.`
                );
            }

            robberData.lastRob = now;

            await setEconomyData(client, guildId, robberId, robberData);
            await setEconomyData(client, guildId, victimUser.id, victimData);

            resultEmbed
                .addFields(
                    {
                        name: `Váš nový zůstatek (${interaction.user.username})`,
                        value: `$${robberData.wallet.toLocaleString()}`,
                        inline: true,
                    },
                    {
                        name: `Nový zůstatek oběti (${victimUser.username})`,
                        value: `$${victimData.wallet.toLocaleString()}`,
                        inline: true,
                    },
                )
                .setFooter({ text: `Nová loupež dostupná za 4 hodiny.` });

            await InteractionHelper.safeEditReply(interaction, { embeds: [resultEmbed] });
    }, { command: 'rob' })
};



