import { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } from 'discord.js';
import { createEmbed } from '../../utils/embeds.js';

import { InteractionHelper } from '../../utils/interactionHelper.js';
export default {
    data: new SlashCommandBuilder()
        .setName("bug")
        .setDescription("Nahlašte bug nebo problém s Discord Botem"),

    async execute(interaction) {
        const githubButton = new ButtonBuilder()
            .setLabel('?? Report Bug on GitHub')
            .setStyle(ButtonStyle.Link)
            .setURL('https://github.com/codebymitch/TitanBot/issues');

        const row = new ActionRowBuilder().addComponents(githubButton);

        const bugReportEmbed = createEmbed({
            title: '?? Bug Report',
            description: 'Narazili jste na chybu nebo máte návrh na vylepšení? Dejte nám vědět přes ticket v <#1429485456667443220>.\n\n' +
           '**Prosíme, přiložte:**\n' +
           '🔹 Co přesně se stalo\n' +
           '🔹 Jak chybu znovu vyvolat\n' +
           '🔹 Screenshoty nebo záznam obrazovky\n' +
           '🔹 Jaký příkaz a další důležité informace\n\n' +
           'Díky tomu dokážeme problém vyřešit mnohem rychleji.',
            color: 'error'
        })
            .setTimestamp();

        await InteractionHelper.safeReply(interaction, {
            embeds: [bugReportEmbed],
            components: [row],
        });
    },
};




