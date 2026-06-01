import { SlashCommandBuilder } from 'discord.js';
import { successEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { handleInteractionError, TitanBotError, ErrorTypes } from '../../utils/errorHandler.js';

import { InteractionHelper } from '../../utils/interactionHelper.js';
export default {
    data: new SlashCommandBuilder()
    .setName("roll")
    .setDescription("Hodí kostkou podle zadané notace (např. 2d6, 1d20 + 4).")
    .addStringOption((option) =>
      option
        .setName("notation")
        .setDescription("Notace kostky (např. 2d6, 1d20 + 4)")
        .setRequired(true)
        .setMaxLength(50),
    ),
  category: 'Fun',

  async execute(interaction, config, client) {
    try {
      await InteractionHelper.safeDefer(interaction);

      const notation = interaction.options
        .getString("notation")
        .toLowerCase()
        .replace(/\s/g, "");

      const match = notation.match(/^(\d*)d(\d+)([\+\-]\d+)?$/);

      if (!match) {
        throw new TitanBotError(
          `neplatná notace kostky: ${notation}`,
          ErrorTypes.USER_INPUT,
          'neplatná notace kostky! Použijte formát jako "2d6" nebo "1d20 + 4".'
        );
      }

      const numDice = parseInt(match[1] || "1", 10);
      const numSides = parseInt(match[2], 10);
      const modifier = parseInt(match[3] || "0", 10);

      
      if (numDice < 1 || numDice > 20) {
        throw new TitanBotError(
          `Příliš mnoho kostek požadováno: ${numDice}`,
          ErrorTypes.VALIDATION,
          'Prosím, držte počet kostek mezi 1 a 20.'
        );
      }

      if (numSides < 1 || numSides > 1000) {
        throw new TitanBotError(
          `Neplatný počet stran: ${numSides}`,
          ErrorTypes.VALIDATION,
          'Prosím, držte počet stran mezi 1 a 1000.'
        );
      }

      let rolls = [];
      let totalRoll = 0;

      for (let i = 0; i < numDice; i++) {
        const roll = Math.floor(Math.random() * numSides) + 1;
        rolls.push(roll);
        totalRoll += roll;
      }

      const finalTotal = totalRoll + modifier;

      const resultsDetail =
        numDice > 1 ? `**Rolls:** ${rolls.join(" + ")}\n` : "";
      const modifierText = modifier !== 0 ? ` + (${modifier})` : "";

      const embed = successEmbed(
        `🎲 Hodí ${numDice}d${numSides}${modifier !== 0 ? match[3] : ""}`,
        `${resultsDetail}**Celkový hod:** ${totalRoll}${modifierText} = **${finalTotal}**`,
      );

      await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
      logger.debug(`Roll command executed by user ${interaction.user.id} with notation ${notation} in guild ${interaction.guildId}`);
    } catch (error) {
      await handleInteractionError(interaction, error, {
        commandName: 'roll',
        source: 'roll_command'
      });
    }
  },
};



