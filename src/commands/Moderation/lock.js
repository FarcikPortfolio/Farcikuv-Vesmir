import { SlashCommandBuilder, PermissionFlagsBits, PermissionsBitField, ChannelType } from 'discord.js';
import { createEmbed, errorEmbed, successEmbed, infoEmbed, warningEmbed } from '../../utils/embeds.js';
import { logEvent } from '../../utils/moderation.js';
import { logger } from '../../utils/logger.js';
import { getColor } from '../../config/bot.js';

import { InteractionHelper } from '../../utils/interactionHelper.js';
export default {
    data: new SlashCommandBuilder()
    .setName("lock")
    .setDescription(
      "Uzamkne aktuální kanál pro všechny kromě Moderátorů.",
    )
.setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
  category: "moderation",

  async execute(interaction, config, client) {
    const deferSuccess = await InteractionHelper.safeDefer(interaction);
    if (!deferSuccess) {
      logger.warn(`Lock interaction defer failed`, {
        userId: interaction.user.id,
        guildId: interaction.guildId,
        commandName: 'lock'
      });
      return;
    }

    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageChannels))
      return await InteractionHelper.safeEditReply(interaction, {
        embeds: [
          errorEmbed(
            "Permission Denied",
            "Potřebujete oprávnění `Manage Channels` pro uzamčení kanálů.",
          ),
        ],
      });

    const channel = interaction.channel;
    const everyoneRole = interaction.guild.roles.everyone;

    try {
      const currentPermissions = channel.permissionsFor(everyoneRole);
      if (currentPermissions.has(PermissionFlagsBits.SendMessages) === false) {
        return await InteractionHelper.safeEditReply(interaction, {
          embeds: [
            errorEmbed(
              "Kanál je již uzamčen",
              `${channel} je již uzamčen pro všechny kromě Moderátorů.`,
            ),
          ],
        });
      }

      await channel.permissionOverwrites.edit(
        everyoneRole,
        { SendMessages: false },
{ type: 0, reason: `Kanál uzamčen uživatelem ${interaction.user.tag}` },
      );

      const lockEmbed = createEmbed(
        "🔒 Kanál uzamčen (Log akcí)",
        `${channel} has been locked down by ${interaction.user}.`,
      )
.setColor(getColor('moderation'))
        .addFields(
          { name: "Channel", value: channel.toString(), inline: true },
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
          action: "Kanál uzamčen",
          target: channel.toString(),
          executor: `${interaction.user.tag} (${interaction.user.id})`,
          metadata: {
            channelId: channel.id,
            category: channel.parent?.name || 'None',
            moderatorId: interaction.user.id
          }
        }
      });

      await InteractionHelper.safeEditReply(interaction, {
        embeds: [
          successEmbed(
            `🔒 **Kanál uzamčen**`,
            `${channel} je nyní uzamčen. Nikdo sem nemůže psát.`,
          ),
        ],
      });
    } catch (error) {
      logger.error('Lock command error:', error);
      await InteractionHelper.safeEditReply(interaction, {
        embeds: [
          errorEmbed(
            "An unexpected error occurred while trying to lock the channel. Check my permissions (I need 'Manage Channels').",
          ),
        ],
      });
    }
  }
};



