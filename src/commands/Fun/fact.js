import { SlashCommandBuilder } from 'discord.js';
import { createEmbed, errorEmbed, successEmbed, infoEmbed, warningEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { handleInteractionError, TitanBotError, ErrorTypes } from '../../utils/errorHandler.js';

import { InteractionHelper } from '../../utils/interactionHelper.js';
const facts = [
  // Obecné fakta
  "Včely mají pět očí.",
  "Největší sněhová vločka zaznamenaná v historii měla průměr 38 cm.",
  "Sloni jsou jediná zvířata, která neumí skákat.",
  "Lidské tělo obsahuje přibližně 60% vody.",
  "Den na Venuši trvá déle než jeden rok na Venuši.",
  "Nejkratší válka v historii proběhla mezi Británií a Zanzibarem 27. srpna 1896. Trvala pouze 38 až 45 minut.",
  "Slovo „Strengths“ je nejdelší anglické slovo, které obsahuje pouze jednu samohlásku.",
  "Chobotnice mají tři srdce a modrou krev.",
  "Na Zemi je více stromů než hvězd v galaxii Mléčná dráha.",
  "Předpokládá se, že celková hmotnost všech mravenců na Zemi je přibližně stejná jako celková hmotnost všech lidí.",
  "Med nikdy nepodléhá zkáze. I tisíce let starý med je stále jedlý.",
  "Žraloci existují déle než stromy.",
  "Banány jsou technicky vzato bobule, ale jahody nejsou.",
  "Lidský nos dokáže rozpoznat více než bilion různých vůní.",
  "Vesmír je tichý, protože zvuk se ve vakuu nešíří.",
  "Největší poušť na světě je Antarktida.",
  "Srdce plejtváka obrovského je velké přibližně jako malé auto.",
  "První počítačová myš byla vyrobena ze dřeva.",
  "Blesk je asi pětkrát teplejší než povrch Slunce.",
  "Koaly mají jedinečné otisky prstů podobné lidským.",
  "Na Jupiteru a Saturnu mohou pršet diamanty.",
  "Většina kyslíku na Zemi pochází z oceánů.",
  "Včely si mezi sebou předávají informace pomocí speciálního tanečku.",
  "Krokodýli neumí vypláznout jazyk.",

  // Minecraft fakta
  "Minecraft byl původně vytvořen během několika dnů Markusem Perssonem, známým jako Notch.",
  "Creepeři vznikli omylem, když Notch špatně naprogramoval model prasete.",
  "Endermani byli inspirováni internetovou postavou Slender Man.",
  "Minecraft je nejprodávanější videohra všech dob.",
  "Ghasti vydávají zvuky vytvořené z nahrávek spící kočky.",
  "Diamantová ruda je jedním z nejvzácnějších bloků v Overworldu.",
  "Ve starších verzích Minecraftu nebyl sprint.",
  "Herobrine nikdy nebyl oficiálně přidán do Minecraftu.",
  "První verze Minecraftu byla vydána v roce 2009.",
  "Axolotli v Minecraftu předstírají smrt, aby se vyhnuli útokům nepřátel.",
  "Piglini tě napadnou, pokud otevřeš truhlu v Netheru bez jejich svolení.",
  "Warden je nejsilnější nepřátelský mob v Minecraftu.",
  "Nether byl původně nazýván 'Hell World'.",
  "Zlaté jablko bylo jedním z prvních speciálních itemů ve hře Minecraft.",
  "Minecraft obsahuje více než 600 různých bloků a itemů.",
  "Když v minecraftu pojmenuješ ovci jménem 'jeb_', bude měnit barvy duhy.",
  "Když v minecraftu pojmenuješ nepřítele 'Dinnerbone', otočí se vzhůru nohama.",
  "Ender Dragon byl první oficiální boss v Minecraftu.",
  "V Minecraftu lze doletět až na Měsíc jen pomocí modů, v základní hře ne.",
  "V jedné Minecraft mapě může být přes 60 milionů bloků od středu světa na každou stranu.",
  "Blue Axolotl má v Minecraftu pouze velmi malou šanci na získání při rozmnožování.",
  "Beacon dokáže dát hráčům speciální efekty na velkou vzdálenost.",
  "Totem nesmrtelnosti v minecraftu dokáže zachránit hráče před smrtí pouze jednou.",
  "Netherite je silnější než diamant a navíc neshoří v lávě.",
  "Minecraft Redstone funguje podobně jako jednoduché elektrické obvody."
];

export default {
    data: new SlashCommandBuilder()
    .setName("fact")
    .setDescription("Pošle náhodný zajímavý fakt, který vás možná překvapí!"),
  category: 'Fun',

  async execute(interaction, config, client) {
    try {
      const randomFact = facts[Math.floor(Math.random() * facts.length)];

      const embed = successEmbed("🧠 Věděl jsi?", `💡 **${randomFact}**`);

      await InteractionHelper.safeReply(interaction, { embeds: [embed] });
      logger.debug(`Fact command executed by user ${interaction.user.id} in guild ${interaction.guildId}`);
    } catch (error) {
      logger.error('Fact command error:', error);
      await handleInteractionError(interaction, error, {
        commandName: 'fact',
        source: 'fact_command'
      });
    }
  },
};




