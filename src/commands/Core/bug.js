import { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } from 'discord.js';
import { createEmbed } from '../../utils/embeds.js';

import { InteractionHelper } from '../../utils/interactionHelper.js';
export default {
    data: new SlashCommandBuilder()
        .setName("bug")
        .setDescription("Nahlašte chybu nebo navrhněte vylepšení pro Discord Bota!"),

    async execute(interaction) {
        const githubButton = new ButtonBuilder()
            .setLabel('🎟️ TICKET SYSTÉM')
            .setStyle(ButtonStyle.Link)
            .setURL('https://discord.com/channels/1429032922446430422/1429485456667443220');

        const row = new ActionRowBuilder().addComponents(githubButton);

        const bugReportEmbed = createEmbed({
            title: '?? Bug Report',
            description: 'Narazili jste na chybu nebo máte návrh na vylepšení? Dejte nám vědět pomocí Ticket systému.\n\n' +
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




