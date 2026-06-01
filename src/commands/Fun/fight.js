import { SlashCommandBuilder } from 'discord.js';
import { successEmbed, warningEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { handleInteractionError } from '../../utils/errorHandler.js';

import { InteractionHelper } from '../../utils/interactionHelper.js';
const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const EMBED_DESCRIPTION_LIMIT = 4096;

export default {
    data: new SlashCommandBuilder()
    .setName("fight")
    .setDescription("Začni boj s jiným uživatelem! Kdo vyhraje? To záleží na štěstí a náhodě.")
    .addUserOption((option) =>
      option
        .setName("opponent")
        .setDescription("Uživatel, se kterým chcete bojovat")
        .setRequired(true),
    ),
  category: 'Fun',

  async execute(interaction, config, client) {
    try {
      await InteractionHelper.safeDefer(interaction);

      const challenger = interaction.user;
      const opponent = interaction.options.getUser("opponent");

      
      if (challenger.id === opponent.id) {
        const embed = warningEmbed(
          `**${challenger.username}**, nemůžeš bojovat sám se sebou! To je remíza, než to vůbec začne.`,
          "⚔️ Neplatná výzva"
        );
        return await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
      }

      
      if (opponent.bot) {
        const embed = warningEmbed(
          "Nemůžeš bojovat s boty! Vyzvi místo toho člena Discord Serveru.",
          "⚔️ Neplatný protihráč"
        );
        return await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
      }

      const winner = rand(0, 1) === 0 ? challenger : opponent;
      const loser = winner.id === challenger.id ? opponent : challenger;
      const rounds = rand(3, 7);
      const damage = rand(10, 50);

      const log = [];
      log.push(
        `💥 **${challenger.username}** vyzvy **${opponent.username}** na souboj! (Best of ${rounds} rounds)`,
      );

      for (let i = 1; i <= rounds; i++) {
        const attacker = rand(0, 1) === 0 ? challenger : opponent;
        const target = attacker.id === challenger.id ? opponent : challenger;
        const action = [
        "zasadí divoký úder",
        "udělí kritický zásah",
        "použije slabé kouzlo",
        "vykryje útok a vrátí úder",
        ][rand(0, 3)];
        log.push(
          `\n**Kolo ${i}:** ${attacker.username} ${action} na ${target.username} pro ${rand(1, damage)} poškození!`,
        );
      }

      const outcomeText = log.join("\n");
      const winnerText = `👑 **${winner.username}** porazil ${loser.username} a prohlašuje se za vítěze!`;
      const fullDescription = `${outcomeText}\n\n${winnerText}`;

      const description = fullDescription.length <= EMBED_DESCRIPTION_LIMIT
        ? fullDescription
        : `${fullDescription.slice(0, EMBED_DESCRIPTION_LIMIT - 15)}\n\n...`;

      const embed = successEmbed(
        description,
        "🏆 Souboj dokončen!"
      );

      await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
      logger.debug(`Fight command executed between ${challenger.id} and ${opponent.id} in guild ${interaction.guildId}`);
    } catch (error) {
      logger.error('Fight command error:', error);
      await handleInteractionError(interaction, error, {
        commandName: 'fight',
        source: 'fight_command'
      });
    }
  },
};





