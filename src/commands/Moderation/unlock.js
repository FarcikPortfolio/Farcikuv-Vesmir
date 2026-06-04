import { SlashCommandBuilder, PermissionFlagsBits, PermissionsBitField, ChannelType } from 'discord.js';
import { createEmbed, errorEmbed, successEmbed, infoEmbed, warningEmbed } from '../../utils/embeds.js';
import { logEvent } from '../../utils/moderation.js';
import { logger } from '../../utils/logger.js';
import { getColor } from '../../config/bot.js';

import { InteractionHelper } from '../../utils/interactionHelper.js';
export default {
    data: new SlashCommandBuilder()
        .setName("unlock")
        .setDescription(
            "Odemkne aktuální kanál (povolí @everyone posílat zprávy znovu).",
        )
.setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
    category: "moderation",

    async execute(interaction, config, client) {
        const deferSuccess = await InteractionHelper.safeDefer(interaction);
        if (!deferSuccess) {
            logger.warn(`Unlock interaction defer failed`, {
                userId: interaction.user.id,
                guildId: interaction.guildId,
                commandName: 'unlock'
            });
            return;
        }

        if (
            !interaction.member.permissions.has(
                PermissionFlagsBits.ManageChannels,
            )
        )
            return await InteractionHelper.safeEditReply(interaction, {
                embeds: [
                    errorEmbed(
                        "Oprávnění zamítnuto",
                        "Potřebujete oprávnění `Spravovat kanály` pro odemknutí kanálů.",
                    ),
                ],
            });

        const channel = interaction.channel;
        const everyoneRole = interaction.guild.roles.everyone;

        try {
            const currentPermissions = channel.permissionsFor(everyoneRole);
            if (
                currentPermissions.has(PermissionFlagsBits.SendMessages) ===
                    true ||
                currentPermissions.has(PermissionFlagsBits.SendMessages) ===
                    null
            ) {
                return await InteractionHelper.safeEditReply(interaction, {
                    embeds: [
                        errorEmbed(
                            "Kanál již je odemčen",
                            `${channel} není explicitně uzamčen (všichni již mohou posílat zprávy).`,
                        ),
                    ],
                });
            }

            await channel.permissionOverwrites.edit(
                everyoneRole,
                { SendMessages: true },
                {
                    type: 0,
                    reason: `Channel unlocked by ${interaction.user.tag}`,
},
            );

            const unlockEmbed = createEmbed(
                "🔓 Kanál odemčen (Action Log)",
                `${channel} has been unlocked by ${interaction.user}.`,
            )
.setColor(getColor('success'))
                .addFields(
                    {
                        name: "Channel",
                        value: channel.toString(),
                        inline: true,
                    },
                    {
                        name: "Moderator",
                        value: `${interaction.user.tag} (${interaction.user.id})`,
                        inline: true,
                    },
                );

            await logEvent({
                client,
                guild: interaction.guild,
                event: {
                    action: "Channel Unlocked",
                    target: channel.toString(),
                    executor: `${interaction.user.tag} (${interaction.user.id})`,
                    metadata: {
                        channelId: channel.id,
                        category: channel.parent?.name || 'None'
                    }
                }
            });

            await InteractionHelper.safeEditReply(interaction, {
                embeds: [
                    successEmbed(
                        `🔓 **Kanál odemčen**`,
                        `${channel} je nyní odemčen. Můžete psát zprávy.`,
                    ),
                ],
            });
        } catch (error) {
            logger.error('Unlock command error:', error);
            await InteractionHelper.safeEditReply(interaction, {
                embeds: [
                    errorEmbed(
                        "An unexpected error occurred while trying to unlock the channel. Check my permissions (I need 'Manage Channels').",
                    ),
                ],
            });
        }
    }
};



