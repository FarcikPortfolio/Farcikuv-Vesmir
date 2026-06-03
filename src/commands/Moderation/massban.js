import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { createEmbed, errorEmbed, successEmbed, infoEmbed, warningEmbed } from '../../utils/embeds.js';
import { logModerationAction } from '../../utils/moderation.js';
import { logger } from '../../utils/logger.js';
import { checkRateLimit } from '../../utils/rateLimiter.js';

import { InteractionHelper } from '../../utils/interactionHelper.js';
export default {
    data: new SlashCommandBuilder()
        .setName("massban")
        .setDescription("Zabanovat více uživatelů najednou. (Max 20 uživatelů)")
        .addStringOption(option =>
            option
                .setName("users")
                .setDescription("Uživatelé k zabanování (ID nebo zmínky, oddělené mezerou nebo čárkou, max 20)")
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName("reason")
                .setDescription("Důvod pro hromadné zabanování")
                .setRequired(false)
        )
        .addIntegerOption(option =>
            option
                .setName("delete_days")
                .setDescription("Počet dní zpráv k odstranění (0-7)")
                .setMinValue(0)
                .setMaxValue(7)
                .setRequired(false)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),
    category: "moderation",

    async execute(interaction, config, client) {
        const deferSuccess = await InteractionHelper.safeDefer(interaction);
        if (!deferSuccess) {
            logger.warn(`Massban interaction defer failed`, {
                userId: interaction.user.id,
                guildId: interaction.guildId,
                commandName: 'massban'
            });
            return;
        }

        if (!interaction.member.permissions.has(PermissionFlagsBits.BanMembers)) {
            return await InteractionHelper.safeEditReply(interaction, {
                embeds: [
                    errorEmbed(
                        "Permission Denied",
                        "Nemáte oprávnění zabanovat uživatele."
                    ),
                ],
            });
        }

        const usersInput = interaction.options.getString("users");
        const reason = interaction.options.getString("reason") || "Mass Ban - Žádný důvod nebyl poskytnut";
        const deleteDays = interaction.options.getInteger("delete_days") || 0;

        try {
            
            const rateLimitKey = `massban_${interaction.user.id}`;
            const isAllowed = await checkRateLimit(rateLimitKey, 3, 60000);
            if (!isAllowed) {
                return await InteractionHelper.safeEditReply(interaction, {
                    embeds: [
                        warningEmbed(
                            "Provádíte hromadná zabanování příliš rychle. Počkejte prosím minutu před dalším pokusem.",
                            "⏳ Omezení rychlosti"
                        ),
                    ],
                    flags: MessageFlags.Ephemeral,
                });
            }

            const userIds = usersInput
.replace(/<@!?(\d+)>/g, '$1')
.split(/[\s,]+/)
.filter(id => id && /^\d+$/.test(id))
.slice(0, 20);

            if (userIds.length === 0) {
                return await InteractionHelper.safeEditReply(interaction, {
                    embeds: [
                        errorEmbed(
                            "Neplatný uživatel",
                            "Prosím zadejte platné ID uživatele nebo zmínky (max 20)."
                        ),
                    ],
                });
            }

            if (userIds.includes(interaction.user.id)) {
                return await InteractionHelper.safeEditReply(interaction, {
                    embeds: [
                        errorEmbed(
                            "Nemůžete zabanovat sám sebe",
                            "Nemůžete zahrnout sám sebe do hromadného zabanování."
                        ),
                    ],
                });
            }

            if (userIds.includes(client.user.id)) {
                return await InteractionHelper.safeEditReply(interaction, {
                    embeds: [
                        errorEmbed(
                            "Nemůžete zabanovat bota",
                            "Nemůžete zahrnout bota do hromadného zabanování."
                        ),
                    ],
                });
            }

            const results = {
                successful: [],
                failed: [],
                skipped: []
            };

            for (const userId of userIds) {
                try {
                    const user = await client.users.fetch(userId).catch(() => null);
                    
                    if (!user) {
                        results.failed.push({ userId, reason: "User not found" });
                        continue;
                    }

                    const member = await interaction.guild.members.fetch(userId).catch(() => null);
                    
                    if (member) {
                        if (member.roles.highest.position >= interaction.member.roles.highest.position && 
                            interaction.guild.ownerId !== interaction.user.id) {
                            results.skipped.push({ 
                                user: user.tag, 
                                userId, 
                                reason: "Cannot ban user with equal or higher role" 
                            });
                            continue;
                        }
                    }

                    await interaction.guild.members.ban(userId, {
                        reason: reason,
                        deleteMessageDays: deleteDays
                    });

                    results.successful.push({
                        user: user.tag,
                        userId
                    });

                    await logModerationAction({
                        client,
                        guild: interaction.guild,
                        event: {
                            action: "Member Banned",
                            target: `${user.tag} (${user.id})`,
                            executor: `${interaction.user.tag} (${interaction.user.id})`,
                            reason: `${reason} (Mass Ban)`,
                            metadata: {
                                userId: user.id,
                                moderatorId: interaction.user.id,
                                massBan: true,
                                permanent: true
                            }
                        }
                    });

                } catch (error) {
                    logger.error(`Failed to ban user ${userId}:`, error);
                    results.failed.push({ 
                        userId, 
                        reason: error.message || "Unknown error" 
                    });
                }
            }

            let description = `**Mass Ban Results:**\n\n`;
            
            if (results.successful.length > 0) {
                description += `✅ **Successfully Banned (${results.successful.length}):**\n`;
                results.successful.forEach(result => {
                    description += `• ${result.user} (${result.userId})\n`;
                });
                description += '\n';
            }

            if (results.skipped.length > 0) {
                description += `⚠️ **Skipped (${results.skipped.length}):**\n`;
                results.skipped.forEach(result => {
                    description += `• ${result.user} - ${result.reason}\n`;
                });
                description += '\n';
            }

            if (results.failed.length > 0) {
                description += `❌ **Failed (${results.failed.length}):**\n`;
                results.failed.forEach(result => {
                    description += `• ${result.userId} - ${result.reason}\n`;
                });
            }

            const embed = results.successful.length > 0 ? successEmbed : warningEmbed;
            
            return await InteractionHelper.safeEditReply(interaction, {
                embeds: [
                    embed(
                        `🔨 Mass Ban Completed`,
                        description
                    )
                ]
            });

        } catch (error) {
            logger.error("Error in massban command:", error);
            return await InteractionHelper.safeEditReply(interaction, {
                embeds: [
                    errorEmbed(
                        "System Error",
                        "An error occurred while processing the mass ban. Please try again later."
                    ),
                ],
            });
        }
    }
};



