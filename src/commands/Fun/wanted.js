import { SlashCommandBuilder } from 'discord.js';
import { createEmbed, errorEmbed, successEmbed, infoEmbed, warningEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { handleInteractionError, TitanBotError, ErrorTypes } from '../../utils/errorHandler.js';
import { sanitizeInput } from '../../utils/sanitization.js';

import { InteractionHelper } from '../../utils/interactionHelper.js';
export default {
    data: new SlashCommandBuilder()
    .setName("wanted")
    .setDescription("Vytvoří wanted poster pro zadaného uživatele s náhodnou odměnou.")
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("Uživatel, který je hledán.")
        .setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName("crime")
        .setDescription("Trest, který spáchal.")
        .setRequired(false)
        .setMaxLength(100),
    ),
  category: 'Fun',

  async execute(interaction, config, client) {
    try {
      await InteractionHelper.safeDefer(interaction);

      const targetUser = interaction.options.getUser("user");
      const crimeRaw = interaction.options.getString("crime");

      
      let crime = "Pro tento server Too adorable for this server.";
      if (crimeRaw) {
        const sanitizedCrime = sanitizeInput(crimeRaw.trim(), 100);
        if (sanitizedCrime.length > 0) {
          crime = sanitizedCrime;
        }
      }

      
      if (!targetUser) {
        throw new TitanBotError(
          'Cílový uživatel nenalezen pro wanted command',
          ErrorTypes.USER_INPUT,
          'Nepodařilo se najít zadaného uživatele. Ujistěte se, že jste správně zmínili uživatele.'
        );
      }

      const bountyAmount = Math.floor(
        Math.random() * (100000000 - 1000000) + 1000000,
      );
      const bounty = `$${bountyAmount.toLocaleString()} USD`;

      const embed = createEmbed({
        color: 'primary',
        title: '💥 VELKÁ ODMĚNA: HLEDÁ SE! 💥',
        description: `**CRIMINAL:** ${targetUser.tag}\n**CRIME:** ${crime}`,
        fields: [
          {
            name: "MRTVÝ NEBO ŽIVÝ",
            value: `**BOUNTY:** ${bounty}`,
            inline: false,
          },
        ],
        image: {
          url: targetUser.displayAvatarURL({ size: 1024, extension: 'png' }),
        },
        footer: {
          text: `Naposledy viděn v ${interaction.guild.name}`,
        },
      });

      await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
      logger.debug(`Wanted command executed by user ${interaction.user.id} for ${targetUser.id} in guild ${interaction.guildId}`);
    } catch (error) {
      logger.error('Wanted command error:', error);
      await handleInteractionError(interaction, error, {
        commandName: 'wanted',
        source: 'wanted_command'
      });
    }
  },
};



