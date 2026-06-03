import { SlashCommandBuilder, PermissionFlagsBits, PermissionsBitField, ChannelType, MessageFlags } from 'discord.js';
import { createEmbed, errorEmbed, successEmbed, infoEmbed, warningEmbed } from '../../utils/embeds.js';
import { logEvent } from '../../utils/moderation.js';
import { logger } from '../../utils/logger.js';
import { sanitizeMarkdown } from '../../utils/sanitization.js';

import { InteractionHelper } from '../../utils/interactionHelper.js';
export default {
    data: new SlashCommandBuilder()
        .setName("dm")
        .setDescription("Pošle soukromou zprávu uživateli. (Staff only)")
        .addUserOption(option =>
            option
                .setName("user")
                .setDescription("Uživatel, kterému chcete poslat zprávu.")
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName("message")
                .setDescription("Zpráva, kterou chcete odeslat")
                .setRequired(true)
        )
        .addBooleanOption(option =>
            option
                .setName("anonymous")
                .setDescription("Odeslat zprávu anonymně (výchozí: false)")
                .setRequired(false)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .setDMPermission(false),
    category: "Moderation",

    async execute(interaction, config, client) {
        const deferSuccess = await InteractionHelper.safeDefer(interaction);
        if (!deferSuccess) {
            logger.warn(`DM interaction defer failed`, {
                userId: interaction.user.id,
                guildId: interaction.guildId,
                commandName: 'dm'
            });
            return;
        }

    const targetUser = interaction.options.getUser("user");
        const message = interaction.options.getString("message");
        const anonymous = interaction.options.getBoolean("anonymous") || false;

        try {
            
            if (message.length > 2000) {
                return await InteractionHelper.safeEditReply(interaction, {
                    embeds: [
                        errorEmbed(
                            "Zpráva je příliš dlouhá",
                            "Zopráva nesmí být delší než 2000 znaků."
                        ),
                    ],
                    flags: MessageFlags.Ephemeral,
                });
            }

            
            if (targetUser.bot) {
                return await InteractionHelper.safeEditReply(interaction, {
                    embeds: [
                        errorEmbed(
                            "Nemůžete poslat DM botům",
                            "Nemůžete poslat soukromé zprávy botům."
                        ),
                    ],
                    flags: MessageFlags.Ephemeral,
                });
            }

            
            const sanitized = sanitizeMarkdown(message);

            const dmChannel = await targetUser.createDM();
            
            await dmChannel.send({
                embeds: [
                    successEmbed(
                        anonymous ? "Zpráva od moderátora" : `Zpráva od ${interaction.user.tag}`,
                        sanitized
                    ).setFooter({
                        text: `Nemůžete odpovídat na tuto zprávu. | Logger ID: ${interaction.id}`
                    })
                ]
            });

            await logEvent({
                client: interaction.client,
                guild: interaction.guild,
                event: {
                    action: "DM Sent",
                    target: `${targetUser.tag} (${targetUser.id})`,
                    executor: `${interaction.user.tag} (${interaction.user.id})`,
                    reason: `Anonymous: ${anonymous ? 'Yes' : 'No'}`,
                    metadata: {
                        userId: targetUser.id,
                        moderatorId: interaction.user.id,
                        anonymous,
                        messageLength: sanitized.length
                    }
                }
            });

            return await InteractionHelper.safeEditReply(interaction, {
                embeds: [
                    successEmbed(
                        "DM Sent",
                        `Successfully sent a message to ${targetUser.tag}`
                    ),
                ],
            });
        } catch (error) {
            logger.error('DM command error:', error);
            
if (error.code === 50007) {
                return await InteractionHelper.safeEditReply(interaction, {
                    embeds: [
                        errorEmbed("Error", `Could not send a DM to ${targetUser.tag}. They may have DMs disabled.`),
                    ],
                });
            }
            
            return await InteractionHelper.safeEditReply(interaction, {
                embeds: [
                    errorEmbed("Error", `Failed to send DM: ${error.message}`),
                ],
            });
        }
    }
};


