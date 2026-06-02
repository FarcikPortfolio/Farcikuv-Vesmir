import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { errorEmbed, successEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { TitanBotError, ErrorTypes, handleInteractionError } from '../../utils/errorHandler.js';
import { getGuildGiveaways, saveGiveaway } from '../../utils/giveaways.js';
import { 
    endGiveaway as endGiveawayService,
    createGiveawayEmbed, 
    createGiveawayButtons 
} from '../../services/giveawayService.js';
import { logEvent, EVENT_TYPES } from '../../services/loggingService.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

export default {
    data: new SlashCommandBuilder()
        .setName("gend")
        .setDescription(
            "Ukončí existující giveaway pomocí ID zprávy. Ujistěte se, že zadáváte správné ID zprávy pro giveaway.",
        )
        .addStringOption((option) =>
            option
                .setName("messageid")
                .setDescription("ID zprávy giveaway, kterou chcete ukončit.")
                .setRequired(true),
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    async execute(interaction) {
        try {
            
            if (!interaction.inGuild()) {
                throw new TitanBotError(
                    'Giveaway příkaz použit mimo server',
                    ErrorTypes.VALIDATION,
                    'Tento příkaz lze použít pouze na serveru.',
                    { userId: interaction.user.id }
                );
            }

            
            if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
                throw new TitanBotError(
                    'Člen bez oprávnění Manage Guild se pokusil ukončit giveaway',
                    ErrorTypes.PERMISSION,
                    "Potřebujete oprávnění 'Spravovat server' pro ukončení giveaway.",
                    { userId: interaction.user.id, guildId: interaction.guildId }
                );
            }

            logger.info(`Giveaway end initiated by ${interaction.user.tag} in guild ${interaction.guildId}`);

            const messageId = interaction.options.getString("messageid");

            
            if (!messageId || !/^\d+$/.test(messageId)) {
                throw new TitanBotError(
                    'Neplatný formát ID zprávy',
                    ErrorTypes.VALIDATION,
                    'Please provide a valid message ID.',
                    { providedId: messageId }
                );
            }

            const giveaways = await getGuildGiveaways(interaction.client, interaction.guildId);
            const giveaway = giveaways.find(g => g.messageId === messageId);

            if (!giveaway) {
                throw new TitanBotError(
                    `Giveaway nebyla nalezena: ${messageId}`,
                    ErrorTypes.VALIDATION,
                    "Žádná giveaway s tímto ID zprávy nebyla nalezena.",
                    { messageId, guildId: interaction.guildId }
                );
            }

            
            const endResult = await endGiveawayService(
                interaction.client,
                giveaway,
                interaction.guildId,
                interaction.user.id
            );

            const updatedGiveaway = endResult.giveaway;
            const winners = endResult.winners;

            
            const channel = await interaction.client.channels.fetch(
                updatedGiveaway.channelId,
            ).catch(err => {
                logger.warn(`Could not fetch channel ${updatedGiveaway.channelId}:`, err.message);
                return null;
            });

            if (!channel || !channel.isTextBased()) {
                throw new TitanBotError(
                    `Kanál nebyl nalezen: ${updatedGiveaway.channelId}`,
                    ErrorTypes.VALIDATION,
                    "Nepodařilo se najít kanál, kde byla giveaway hostována. Stav giveaway byl aktualizován.",
                    { channelId: updatedGiveaway.channelId, messageId }
                );
            }

            const message = await channel.messages
                .fetch(messageId)
                .catch(err => {
                    logger.warn(`Could not fetch message ${messageId}:`, err.message);
                    return null;
                });

            if (!message) {
                throw new TitanBotError(
                    `Zpráva nebyla nalezena: ${messageId}`,
                    ErrorTypes.VALIDATION,
                    "Nepodařilo se najít zprávu giveaway. Stav giveaway byl aktualizován.",
                    { messageId, channelId: updatedGiveaway.channelId }
                );
            }

            
            await saveGiveaway(
                interaction.client,
                interaction.guildId,
                updatedGiveaway,
            );

            
            const newEmbed = createGiveawayEmbed(updatedGiveaway, "ended", winners);
            const newRow = createGiveawayButtons(true);

            await message.edit({
                content: "🎉 **GIVEAWAY UKONČENA** 🎉",
                embeds: [newEmbed],
                components: [newRow],
            });

            
            if (winners.length > 0) {
                const winnerMentions = winners
                    .map((id) => `<@${id}>`)
                    .join(", ");
                const winnerPingMsg = await channel.send({
                    content: `🎉 GRATULUJEME ${winnerMentions}! Vyhráli jste **${updatedGiveaway.prize}** giveaway! Prosím, kontaktujte hostitele <@${updatedGiveaway.hostId}> pro nárokování vašeho cen.`,
                });
                updatedGiveaway.winnerPingMessageId = winnerPingMsg.id;
                await saveGiveaway(interaction.client, interaction.guildId, updatedGiveaway);

                logger.info(`Giveaway ended with ${winners.length} winner(s): ${messageId}`);

                
                try {
                    await logEvent({
                        client: interaction.client,
                        guildId: interaction.guildId,
                        eventType: EVENT_TYPES.GIVEAWAY_WINNER,
                        data: {
                            description: `Giveaway ended with ${winners.length} winner(s)`,
                            channelId: channel.id,
                            userId: interaction.user.id,
                            fields: [
                                {
                                    name: '🎁 Cena',
                                    value: updatedGiveaway.prize || 'Mystery Prize!',
                                    inline: true
                                },
                                {
                                    name: '🏆 Počet výherců',
                                    value: winnerMentions,
                                    inline: false
                                },
                                {
                                    name: '👥 Počet účastníků',
                                    value: endResult.participantCount.toString(),
                                    inline: true
                                }
                            ]
                        }
                    });
                } catch (logError) {
                    logger.debug('Error logging giveaway winner event:', logError);
                }
            } else {
                await channel.send({
                    content: `Giveway pro **${updatedGiveaway.prize}** byla ukončena, ale nebyl vybrán žádný výherce.`,
                });
                logger.info(`Giveaway ukončena bez výherců: ${messageId}`);
            }

            logger.info(`Giveaway successfully ended by ${interaction.user.tag}: ${messageId}`);

            return InteractionHelper.safeReply(interaction, {
                embeds: [
                    successEmbed(
                        "Giveaway ukončena ✅",
                        `Úspěšně ukončena giveaway pro **${updatedGiveaway.prize}** v ${channel}. Vybráno ${winners.length} výherce z ${endResult.participantCount} přihlášek.`,
                    ),
                ],
                flags: MessageFlags.Ephemeral,
            });

        } catch (error) {
            await handleInteractionError(interaction, error, {
                type: 'command',
                commandName: 'gend',
                context: 'giveaway_end'
            });
        }
    },
};



