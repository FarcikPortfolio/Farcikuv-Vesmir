import { SlashCommandBuilder } from 'discord.js';
import { createEmbed, errorEmbed, successEmbed, infoEmbed, warningEmbed } from '../../utils/embeds.js';
import { getEconomyData, addMoney, removeMoney, setEconomyData } from '../../utils/economy.js';
import { withErrorHandling, createError, ErrorTypes } from '../../utils/errorHandler.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { MessageTemplates } from '../../utils/messageTemplates.js';
import EconomyService from '../../services/economyService.js';

export default {
    data: new SlashCommandBuilder()
        .setName('pay')
        .setDescription('Zaplť někomu jinému peníze z tvé peněženky.')
        .addUserOption(option =>
            option
                .setName('user')
                .setDescription('Uživatel, kterému chcete zaplatit')
                .setRequired(true)
        )
        .addIntegerOption(option =>
            option
                .setName('amount')
                .setDescription('Částka k zaplacení')
                .setRequired(true)
                .setMinValue(1)
        ),

    execute: withErrorHandling(async (interaction, config, client) => {
        const deferred = await InteractionHelper.safeDefer(interaction);
        if (!deferred) return;
            
            const senderId = interaction.user.id;
            const receiver = interaction.options.getUser("user");
            const amount = interaction.options.getInteger("amount");
            const guildId = interaction.guildId;

            logger.debug(`[ECONOMY] Platební příkaz zahájen`, { 
                senderId, 
                receiverId: receiver.id,
                amount,
                guildId
            });

            if (receiver.bot) {
                throw createError(
                    "Nemůžete platit botovi!",
                    ErrorTypes.VALIDATION,
                    "Nemlžete platit botovi. Vyberte člena na Discord serveru, kterému chcete zaplatit.",
                    { receiverId: receiver.id, isBot: true }
                );
            }
            
            if (receiver.id === senderId) {
                throw createError(
                    "Nemůžete platit sám sobě!",
                    ErrorTypes.VALIDATION,
                    "Nemůžete platit sám sobě.",
                    { senderId, receiverId: receiver.id }
                );
            }
            
            if (amount <= 0) {
                throw createError(
                    "Neplatná částka",
                    ErrorTypes.VALIDATION,
                    "Částka musí být větší než nula.",
                    { amount, senderId }
                );
            }

            const [senderData, receiverData] = await Promise.all([
                getEconomyData(client, guildId, senderId),
                getEconomyData(client, guildId, receiver.id)
            ]);

            if (!senderData) {
                throw createError(
                    "Selhání při načítání ekonomických dat odesílatele",
                    ErrorTypes.DATABASE,
                    "Selhání při načítání ekonomických dat odesílatele. Prosím zkuste to později.",
                    { userId: senderId, guildId }
                );
            }
            
            if (!receiverData) {
                throw createError(
                    "Selhání při načítání ekonomických dat příjemce",
                    ErrorTypes.DATABASE,
                    "Selhání při načítání ekonomických dat příjemce. Prosím zkuste to později.",
                    { userId: receiver.id, guildId }
                );
            }

            
            
            const result = await EconomyService.transferMoney(
                client, 
                guildId, 
                senderId, 
                receiver.id, 
                amount
            );

            
            const updatedSenderData = await getEconomyData(client, guildId, senderId);
            const updatedReceiverData = await getEconomyData(client, guildId, receiver.id);

            const embed = MessageTemplates.SUCCESS.DATA_UPDATED(
                "payment",
                `Úspěšně jste zaplatil **${receiver.username}** částku **$${amount.toLocaleString()}**!`
            )
                .addFields(
                    {
                        name: "💳 Částka platby",
                        value: `$${amount.toLocaleString()}`,
                        inline: true,
                    },
                    {
                        name: "💵 Váš nový zůstatek",
                        value: `$${updatedSenderData.wallet.toLocaleString()}`,
                        inline: true,
                    },
                )
                .setFooter({
                    text: `Paid to ${receiver.tag}`,
                    iconURL: receiver.displayAvatarURL(),
                });

            await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });

            logger.info(`[ECONOMY] Payment sent successfully`, {
                senderId,
                receiverId: receiver.id,
                amount,
                senderBalance: updatedSenderData.wallet,
                receiverBalance: updatedReceiverData.wallet
            });

            try {
                const receiverEmbed = createEmbed({ 
                    title: "💰 Příchozí platba!", 
                    description: `${interaction.user.username} vám zaplatil **$${amount.toLocaleString()}**.` 
                }).addFields({
                    name: "Váš nový zůstatek",
                    value: `$${updatedReceiverData.wallet.toLocaleString()}`,
                    inline: true,
                });
                await receiver.send({ embeds: [receiverEmbed] });
            } catch (e) {
                    logger.warn(`Nepodařilo se odeslat DM uživateli ${receiver.id}: ${e.message}`);
            }
    }, { command: 'pay' })
};





