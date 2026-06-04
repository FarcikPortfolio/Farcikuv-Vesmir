import { SlashCommandBuilder, PermissionFlagsBits, PermissionsBitField, ChannelType, MessageFlags } from 'discord.js';
import { createEmbed, errorEmbed, successEmbed, infoEmbed, warningEmbed } from '../../utils/embeds.js';
import { logEvent } from '../../utils/moderation.js';
import { logger } from '../../utils/logger.js';
import { checkRateLimit } from '../../utils/rateLimiter.js';
import { getColor } from '../../config/bot.js';

import { InteractionHelper } from '../../utils/interactionHelper.js';
export default {
    data: new SlashCommandBuilder()
    .setName("purge")
    .setDescription("Smazat více zpráv najednou (1-100)")
    .addIntegerOption((option) =>
      option
        .setName("amount")
        .setDescription("Počet zpráv (1-100)")
        .setRequired(true),
    )
.setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
  category: "moderation",

  async execute(interaction, config, client) {
    const deferSuccess = await InteractionHelper.safeDefer(interaction);
    if (!deferSuccess) {
      logger.warn(`Purge interaction defer failed`, {
        userId: interaction.user.id,
        guildId: interaction.guildId,
        commandName: 'purge'
      });
      return;
    }

    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages))
      return await InteractionHelper.safeEditReply(interaction, {
        embeds: [
          errorEmbed(
            "Oprávnění zamítnuto",
            "Potřebujete oprávnění `Spravovat zprávy` pro smazání zpráv.",
          ),
        ],
      });

    const amount = interaction.options.getInteger("amount");
    const channel = interaction.channel;

    if (amount < 1 || amount > 100)
      return await InteractionHelper.safeEditReply(interaction, {
        embeds: [
          errorEmbed(
            "Neplatný počet",
            "Prosím zadejte číslo mezi 1 a 100 pro počet zpráv ke smazání.",
          ),
        ],
      });

    try {
      
      const rateLimitKey = `purge_${interaction.user.id}`;
      const isAllowed = await checkRateLimit(rateLimitKey, 5, 60000);
      if (!isAllowed) {
        return await InteractionHelper.safeEditReply(interaction, {
          embeds: [
            warningEmbed(
              "Příliš rychlé mazání zpráv. Počkejte prosím minutu před dalším pokusem.",
              "⏳ Omezeno"
            ),
          ],
          flags: MessageFlags.Ephemeral,
        });
      }

      const fetched = await channel.messages.fetch({ limit: amount });
      const deleted = await channel.bulkDelete(fetched, true);
      const deletedCount = deleted.size;

      const purgeEmbed = createEmbed(
        "🗑️ Smazané zprávy",
        `${deletedCount} messages were deleted by ${interaction.user}.`,
      )
.setColor(getColor('moderation'))
        .addFields(
          { name: "Channel", value: channel.toString(), inline: true },
          {
            name: "Moderator",
            value: `${interaction.user.tag} (${interaction.user.id})`,
            inline: true,
          },
          { name: "Count", value: `${deletedCount} messages`, inline: false },
        );

      await logEvent({
        client,
        guild: interaction.guild,
        event: {
          action: "Messages Purged",
          target: `${channel} (${deletedCount} messages)`,
          executor: `${interaction.user.tag} (${interaction.user.id})`,
          reason: `Deleted ${deletedCount} messages`,
          metadata: {
            channelId: channel.id,
            messageCount: deletedCount,
            requestedAmount: amount,
            moderatorId: interaction.user.id
          }
        }
      });

      await InteractionHelper.safeEditReply(interaction, {
        embeds: [
          successEmbed(`🗑️ Smazané ${deletedCount} zprávy v ${channel}.`),
        ],
flags: MessageFlags.Ephemeral,
      });

      setTimeout(() => {
        interaction.deleteReply().catch(err => 
          logger.debug('Failed to auto-delete purge response:', err)
        );
      }, 3000);
    } catch (error) {
      logger.error('Purge command error:', error);
      await InteractionHelper.safeEditReply(interaction, {
        embeds: [
          errorEmbed(
            "An unexpected error occurred during message deletion. Note: Messages older than 14 days cannot be bulk deleted.",
          ),
        ],
        flags: MessageFlags.Ephemeral,
      });
    }
  }
};



