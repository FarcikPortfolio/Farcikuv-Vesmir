import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { errorEmbed, successEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { TitanBotError, ErrorTypes, handleInteractionError } from '../../utils/errorHandler.js';
import { getGuildGiveaways, saveGiveaway } from '../../utils/giveaways.js';
import { 
    selectWinners,
    createGiveawayEmbed, 
    createGiveawayButtons 
} from '../../services/giveawayService.js';
import { logEvent, EVENT_TYPES } from '../../services/loggingService.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

export default {
    data: new SlashCommandBuilder()
        .setName("greroll")
        .setDescription("Znovu vylosuje výherce pro ukončenou giveaway pomocí ID zprávy.")
        .addStringOption((option) =>
            option
                .setName("messageid")
                .setDescription("ID zprávy giveaway, kterou chcete znovu vylosovat.")
                .setRequired(true),
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    async execute(interaction) {
        try {
            
            if (!interaction.inGuild()) {
                throw new TitanBotError(
                    'Giveaway příkaz použit mimo server',
                    ErrorTypes.VALIDATION,
                    'Tento příkaz lze použít pouze v serveru.',
                    { userId: interaction.user.id }
                );
            }

            
            if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
                throw new TitanBotError(
                    'Člen bez oprávnění Manage Guild se pokusil znovu vylosovat giveaway',
                    ErrorTypes.PERMISSION,
                    "Potřebujete oprávnění 'Spravovat server' pro znovu vylosování giveaway.",
                    { userId: interaction.user.id, guildId: interaction.guildId }
                );
            }

            logger.info(`Giveaway reroll initiated by ${interaction.user.tag} in guild ${interaction.guildId}`);

            const messageId = interaction.options.getString("messageid");

            
            if (!messageId || !/^\d+$/.test(messageId)) {
                throw new TitanBotError(
                    'Selhání při znovu vylosování giveaway kvůli neplatnému ID zprávy',
                    ErrorTypes.VALIDATION,
                    'Prosím, zadejte platné ID zprávy.',
                    { providedId: messageId }
                );
            }

            const giveaways = await getGuildGiveaways(
                interaction.client,
                interaction.guildId,
            );

            
            const giveaway = giveaways.find(g => g.messageId === messageId);

            if (!giveaway) {
                throw new TitanBotError(
                    `Giveaway nebyla nalezena: ${messageId}`,
                    ErrorTypes.VALIDATION,
                    "Žádná giveaway s tímto ID zprávy nebyla nalezena.",
                    { messageId, guildId: interaction.guildId }
                );
            }

            
            if (!giveaway.isEnded && !giveaway.ended) {
                throw new TitanBotError(
                    `Giveaway stále aktivní: ${messageId}`,
                    ErrorTypes.VALIDATION,
                    "Tato giveaway je stále aktivní. Prosím, použijte `/gend` pro její ukončení.",
                    { messageId, status: 'active' }
                );
            }

            const participants = giveaway.participants || [];
            
            if (participants.length < giveaway.winnerCount) {
                throw new TitanBotError(
                    `Nedostatek účastníků: ${participants.length} < ${giveaway.winnerCount}`,
                    ErrorTypes.VALIDATION,
                    "Není dostatek účastníků k výběru požadovaného počtu výherců.",
                    { participantsCount: participants.length, winnersNeeded: giveaway.winnerCount }
                );
            }

            
            const newWinners = selectWinners(
                participants,
                giveaway.winnerCount,
            );

            
            const updatedGiveaway = {
                ...giveaway,
                winnerIds: newWinners,
                rerolledAt: new Date().toISOString(),
                rerolledBy: interaction.user.id
            };

            
            const channel = await interaction.client.channels.fetch(
                giveaway.channelId,
            ).catch(err => {
                logger.warn(`Nepodařilo se načíst kanál ${giveaway.channelId}:`, err.message);
                return null;
            });

            if (!channel || !channel.isTextBased()) {
                
                await saveGiveaway(
                    interaction.client,
                    interaction.guildId,
                    updatedGiveaway,
                );
                
                logger.warn(`Nepodařilo se najít kanál pro oznámení znovu vylosovaných výherců: ${giveaway.channelId}`);
                
                return InteractionHelper.safeReply(interaction, {
                    embeds: [
                        successEmbed(
                            "Opětovné losování dokončeno, ale kanál nenalezen ✅",
                            "Nové výherce jsme vybrali, ale nemohli jsme najít původní kanál pro oznámení. Prosím, zkontrolujte nastavení giveaway a ujistěte se, že kanál stále existuje.",
                        ),
                    ],
                    flags: MessageFlags.Ephemeral,
                });
            }

            
            const message = await channel.messages
                .fetch(messageId)
                .catch(err => {
                    logger.warn(`Nepodařilo se načíst zprávu ${messageId}:`, err.message);
                    return null;
                });

            if (!message) {
                
                await saveGiveaway(
                    interaction.client,
                    interaction.guildId,
                    updatedGiveaway,
                );

                const winnerMentions = newWinners
                    .map((id) => `<@${id}>`)
                    .join(", ");
                
                // Edit the original winner ping if it still exists, otherwise send a new one
                const existingPingMsg = giveaway.winnerPingMessageId
                    ? await channel.messages.fetch(giveaway.winnerPingMessageId).catch(() => null)
                    : null;
                if (existingPingMsg) {
                    await existingPingMsg.edit({
                        content: `🔄 **GIVEAWAY ZNOVU VYLOSOVÁNA** 🔄 Nové výherce pro **${giveaway.prize}**: ${winnerMentions}!`,
                    });
                } else {
                    const newPingMsg = await channel.send({
                        content: `🔄 **GIVEAWAY ZNOVU VYLOSOVÁNA** 🔄 Nové výherce pro **${giveaway.prize}**: ${winnerMentions}!`,
                    });
                    updatedGiveaway.winnerPingMessageId = newPingMsg.id;
                }

                logger.info(`Giveaway znovu vylosována, ale zpráva nenalezena: ${messageId} v kanálu ${channel.id}`);

                try {
                    await logEvent({
                        client: interaction.client,
                        guildId: interaction.guildId,
                        eventType: EVENT_TYPES.GIVEAWAY_REROLL,
                        data: {
                            description: `Giveaway znovu vylosována: ${giveaway.prize}`,
                            channelId: giveaway.channelId,
                            userId: interaction.user.id,
                            fields: [
                                {
                                    name: '🎁 Cena',
                                    value: giveaway.prize || 'Mystery Prize!',
                                    inline: true
                                },
                                {
                                    name: '🏆 Nové výherce',
                                    value: winnerMentions,
                                    inline: false
                                },
                                {
                                    name: '👥 Celkový počet přihlášek',
                                    value: participants.length.toString(),
                                    inline: true
                                }
                            ]
                        }
                    });
                } catch (logError) {
                    logger.debug('Error logging giveaway reroll:', logError);
                }

                return InteractionHelper.safeReply(interaction, {
                    embeds: [
                        successEmbed(
                            "Opětovné losování dokončeno, ale kanál nenalezen ✅",
                            `Nové výherce jsme vybrali, ale nemohli jsme najít původní kanál pro oznámení. Prosím, zkontrolujte nastavení giveaway a ujistěte se, že kanál stále existuje.`,
                        ),
                    ],
                    flags: MessageFlags.Ephemeral,
                });
            }

            
            await saveGiveaway(
                interaction.client,
                interaction.guildId,
                updatedGiveaway,
            );

            const newEmbed = createGiveawayEmbed(updatedGiveaway, "reroll", newWinners);
            const newRow = createGiveawayButtons(true);

            await message.edit({
                content: "🔄 **GIVEAWAY ZNOVU VYLOSOVÁNA** 🔄",
                embeds: [newEmbed],
                components: [newRow],
            });

            const winnerMentions = newWinners
                .map((id) => `<@${id}>`)
                .join(", ");
            
            // Edit the original winner ping if it still exists, otherwise send a new one
            const existingPingMsg = giveaway.winnerPingMessageId
                ? await channel.messages.fetch(giveaway.winnerPingMessageId).catch(() => null)
                : null;
            if (existingPingMsg) {
                await existingPingMsg.edit({
                    content: `🔄 **ZNOVU VYLOSOVANÉ VÝHERCE** 🔄 GRATULUJEME ${winnerMentions}! Jsou novými výherci pro **${giveaway.prize}** giveaway! Prosím, kontaktujte hosta <@${giveaway.hostId}> a vyplňte svou cenu.`,
                });
            } else {
                const newPingMsg = await channel.send({
                    content: `🔄 **ZNOVU VYLOSOVANÉ VÝHERCE** 🔄 GRATULUJEME ${winnerMentions}! Jsou novými výherci pro **${giveaway.prize}** giveaway! Prosím, kontaktujte hosta <@${giveaway.hostId}> a vyplňte svou cenu.`,
                });
                updatedGiveaway.winnerPingMessageId = newPingMsg.id;
            }

            logger.info(`Giveaway successfully rerolled: ${messageId} with ${newWinners.length} new winners`);

            try {
                await logEvent({
                    client: interaction.client,
                    guildId: interaction.guildId,
                    eventType: EVENT_TYPES.GIVEAWAY_REROLL,
                    data: {
                        description: `Giveaway znovu vylosována: ${giveaway.prize}`,
                        channelId: giveaway.channelId,
                        userId: interaction.user.id,
                        fields: [
                            {
                                name: '🎁 Cena',
                                value: giveaway.prize || 'Mystery Prize!',
                                inline: true
                            },
                            {
                                name: '🏆 Nové výherce',
                                value: winnerMentions,
                                inline: false
                            },
                            {
                                name: '👥 Celkový počet přihlášek',
                                value: participants.length.toString(),
                                inline: true
                            }
                        ]
                    }
                });
            } catch (logError) {
                logger.debug('Error logging giveaway znovu vylosována event:', logError);
            }

            return InteractionHelper.safeReply(interaction, {
                embeds: [
                    successEmbed(
                        "Znovu vylosována ✅",
                        `Úspěšně znovu vylosována giveaway pro **${giveaway.prize}** v ${channel}. Vybráno ${newWinners.length} nového(vých) výherce(s).`,
                    ),
                ],
                flags: MessageFlags.Ephemeral,
            });

        } catch (error) {
            logger.error('Error in greroll command:', error);
            await handleInteractionError(interaction, error, {
                type: 'command',
                commandName: 'greroll',
                context: 'giveaway_reroll'
            });
        }
    },
};



