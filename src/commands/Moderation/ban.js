import { SlashCommandBuilder, PermissionFlagsBits, PermissionsBitField, ChannelType } from 'discord.js';
import { createEmbed, errorEmbed, successEmbed, infoEmbed, warningEmbed } from '../../utils/embeds.js';
import { logModerationAction } from '../../utils/moderation.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { ModerationService } from '../../services/moderationService.js';
import { handleInteractionError } from '../../utils/errorHandler.js';
export default {
    data: new SlashCommandBuilder()
        .setName("ban")
        .setDescription("Zabanovat uživatele ze serveru.")
        .addUserOption((option) =>
            option
                .setName("target")
                .setDescription("Uživatel k zabanování")
                .setRequired(true),
        )
        .addStringOption((option) =>
            option.setName("reason").setDescription("Důvod banu"),
        )
.setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),
    category: "moderation",

    async execute(interaction, config, client) {
        try {
            const user = interaction.options.getUser("target");
            const reason = interaction.options.getString("reason") || "No reason provided";

            if (user.id === interaction.user.id) {
                throw new Error("Nemůžete zabanovat sami sebe.");
            }
            if (user.id === client.user.id) {
                throw new Error("Nemůžete zabanovat bota.");
            }

            
            const result = await ModerationService.banUser({
                guild: interaction.guild,
                user,
                moderator: interaction.member,
                reason
            });

            await InteractionHelper.universalReply(interaction, {
                embeds: [
                    successEmbed(
                        `🚫 **Zabanován** ${user.tag}`,
                        `**Důvod:** ${reason}\n**ID banu:** #${result.caseId}`,
                    ),
                ],
            });
        } catch (error) {
            logger.error('Ban command error:', error);
            await handleInteractionError(interaction, error, { subtype: 'ban_failed' });
        }
    },
};



