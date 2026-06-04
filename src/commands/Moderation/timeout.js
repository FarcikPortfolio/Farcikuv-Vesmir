import { SlashCommandBuilder, PermissionFlagsBits, PermissionsBitField, ChannelType } from 'discord.js';
import { createEmbed, errorEmbed, successEmbed, infoEmbed, warningEmbed } from '../../utils/embeds.js';
import { logModerationAction } from '../../utils/moderation.js';
import { logger } from '../../utils/logger.js';
import { TitanBotError, ErrorTypes } from '../../utils/errorHandler.js';


import { InteractionHelper } from '../../utils/interactionHelper.js';
const durationChoices = [
    { name: "5 minut", value: 5 },
    { name: "10 minut", value: 10 },
    { name: "30 minut", value: 30 },
    { name: "1 hodina", value: 60 },
    { name: "6 hodin", value: 360 },
    { name: "1 den", value: 1440 },
    { name: "1 týden", value: 10080 },
];
export default {
    data: new SlashCommandBuilder()
        .setName("timeout")
        .setDescription("Umlčet uživatele na určitou dobu")
        .addUserOption((option) =>
            option
                .setName("target")
                .setDescription("Uživatel k umlčení")
                .setRequired(true),
        )
        .addIntegerOption(
            (option) =>
                option
                    .setName("duration")
                    .setDescription("Délka umlčení")
                    .setRequired(true)
.addChoices(...durationChoices),
        )
        .addStringOption((option) =>
            option.setName("reason").setDescription("Důvod umlčení"),
        )
.setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
    category: "moderation",

    async execute(interaction, config, client) {
        const deferSuccess = await InteractionHelper.safeDefer(interaction);
        if (!deferSuccess) {
            logger.warn(`Timeout interaction defer failed`, {
                userId: interaction.user.id,
                guildId: interaction.guildId,
                commandName: 'timeout'
            });
            return;
        }

        try {
            if (!interaction.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
                throw new TitanBotError(
                    "Uživatel nemá oprávnění",
                    ErrorTypes.PERMISSION,
                    "Potřebujete oprávnění `Umlčet členy` pro použití tohoto příkazu."
                );
            }

            const targetUser = interaction.options.getUser("target");
            const member = interaction.options.getMember("target");
            const durationMinutes = interaction.options.getInteger("duration");
            const reason = interaction.options.getString("reason") || "No reason provided";

            if (targetUser.id === interaction.user.id) {
                throw new TitanBotError(
                    "Nemůžete umlčet sám sebe",
                    ErrorTypes.VALIDATION,
                    "Nemůžete umlčet sám sebe."
                );
            }
            if (targetUser.id === client.user.id) {
                throw new TitanBotError(
                    "Nemůžete umlčet bota",
                    ErrorTypes.VALIDATION,
                    "Nemůžete umlčet bota."
                );
            }
            if (!member) {
                throw new TitanBotError(
                    "Člen nenalezen",
                    ErrorTypes.USER_INPUT,
                    "Člen nenalezen. Ujistěte se, že jste zadali správného uživatele."
                );
            }

            if (!member.moderatable) {
                throw new TitanBotError(
                    "Nelze umlčet člena",
                    ErrorTypes.PERMISSION,
                    "Nemohu umlčet tohoto uživatele. Může mít vyšší roli než vy."
                );
            }

            const durationMs = durationMinutes * 60 * 1000;
            await member.timeout(durationMs, reason);

            const durationDisplay =
                durationChoices.find((c) => c.value === durationMinutes)
                    ?.name || `${durationMinutes} minutes`;

            const caseId = await logModerationAction({
                client,
                guild: interaction.guild,
                event: {
                    action: "Member Timed Out",
                    target: `${targetUser.tag} (${targetUser.id})`,
                    executor: `${interaction.user.tag} (${interaction.user.id})`,
                    reason: `${reason}\nDuration: ${durationDisplay}`,
                    duration: durationDisplay,
                    metadata: {
                        userId: targetUser.id,
                        moderatorId: interaction.user.id,
                        durationMinutes,
                        timeoutEnds: new Date(Date.now() + durationMs).toISOString()
                    }
                }
            });

            await InteractionHelper.safeEditReply(interaction, {
                embeds: [
                    successEmbed(
                        `⏳ **Umlčen** ${targetUser.tag} na ${durationDisplay}.`,
                        `**Důvod:** ${reason}\n**ID případu:** #${caseId}`,
                    ),
                ],
            });
        } catch (error) {
            logger.error('Timeout command error:', error);
            await InteractionHelper.safeEditReply(interaction, {
                embeds: [
                    errorEmbed(
                        error.userMessage || "An unexpected error occurred during the timeout action. Please check my role permissions.",
                    ),
                ],
            });
        }
    }
};



