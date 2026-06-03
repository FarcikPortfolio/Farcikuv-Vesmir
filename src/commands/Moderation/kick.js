import { SlashCommandBuilder, PermissionFlagsBits, PermissionsBitField, ChannelType } from 'discord.js';
import { createEmbed, errorEmbed, successEmbed, infoEmbed, warningEmbed } from '../../utils/embeds.js';
import { logModerationAction } from '../../utils/moderation.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { TitanBotError, ErrorTypes } from '../../utils/errorHandler.js';

export default {
    data: new SlashCommandBuilder()
    .setName("kick")
    .setDescription("Kickne člena ze serveru.")
    .addUserOption((option) =>
      option
        .setName("target")
        .setDescription("Uživatel, kterého chcete kicknout")
        .setRequired(true),
    )
    .addStringOption((option) =>
      option.setName("reason").setDescription("Důvod kicknutí"),
    )
.setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),
  category: "moderation",

  async execute(interaction, config, client) {
    try {
      
      if (!interaction.member.permissions.has(PermissionFlagsBits.KickMembers)) {
        throw new TitanBotError(
          "User lacks permission",
          ErrorTypes.PERMISSION,
          "Nemáte dostatečné oprávnění ke kicknutí členů."
        );
      }

      const targetUser = interaction.options.getUser("target");
      const member = interaction.options.getMember("target");
      const reason = interaction.options.getString("reason") || "Žádný důvod nebyl poskytnut";

      
      if (targetUser.id === interaction.user.id) {
        throw new TitanBotError(
          "Nemůžete kicknout sami sebe",
          ErrorTypes.VALIDATION,
          "Nemůžete kicknout sám sebe."
        );
      }

      
      if (targetUser.id === client.user.id) {
        throw new TitanBotError(
          "Nemůžete kicknout bota",
          ErrorTypes.VALIDATION,
          "Nemůžete kicknout bota."
        );
      }

      
      if (!member) {
        throw new TitanBotError(
          "Target not found",
          ErrorTypes.USER_INPUT,
          "Uživatel nebyl nalezen.",
          { subtype: 'user_not_found' }
        );
      }

      
      if (interaction.member.roles.highest.position <= member.roles.highest.position) {
        throw new TitanBotError(
          "Cannot kick user",
          ErrorTypes.PERMISSION,
          "Nemůžete kicknout uživatele se stejnou nebo vyšší rolí než máte vy."
        );
      }

      
      if (!member.kickable) {
        throw new TitanBotError(
          "Bot cannot kick",
          ErrorTypes.PERMISSION,
          "Nemůžete kicknout tohoto uživatele. Prosím, zkontrolujte pozici své role vzhledem k cílovému uživateli."
        );
      }

      
      await member.kick(reason);

      
      const caseId = await logModerationAction({
        client,
        guild: interaction.guild,
        event: {
          action: "Uživatel kicknut",
          target: `${targetUser.tag} (${targetUser.id})`,
          executor: `${interaction.user.tag} (${interaction.user.id})`,
          reason,
          metadata: {
            userId: targetUser.id,
            moderatorId: interaction.user.id
          }
        }
      });

      
      await InteractionHelper.universalReply(interaction, {
        embeds: [
          successEmbed(
            `👢 **Kicknut** ${targetUser.tag}`,
            `**Důvod:** ${reason}\n**ID případu:** #${caseId}`,
          ),
        ],
      });
    } catch (error) {
      logger.error('Kick command error:', error);
      const errorEmbed_default = errorEmbed(
        "An unexpected error occurred while trying to kick the user.",
        error.message || "Nepodařilo se kicknout uživatele z důvodu neočekávané chyby."
      );
      await InteractionHelper.universalReply(interaction, { embeds: [errorEmbed_default] });
    }
  }
};



