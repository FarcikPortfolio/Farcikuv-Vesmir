import {
    SlashCommandBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
} from "discord.js";
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { createEmbed } from "../../utils/embeds.js";
import {
    createSelectMenu,
} from "../../utils/components.js";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CATEGORY_SELECT_ID = "help-category-select";
const ALL_COMMANDS_ID = "help-all-commands";
const BUG_REPORT_BUTTON_ID = "help-bug-report";
const HELP_MENU_TIMEOUT_MS = 5 * 60 * 1000;

const CATEGORY_ICONS = {
   Informace: "ℹ️",
   Moderace: "🛡️",
   Ekonomika: "💰",
   Zábava: "🎮",
   Leveling: "📊",
   Nástroje: "🔧",
   Tickety: "🎫",
   Uvítání: "👋",
   Soutěže: "🎉",
   Počítadla: "🔢",
   Pokročilé_Nástroje: "🛠️",
   Vyhledávání: "🔍",
   Role_Reakcemi: "🎭",
   Komunita: "👥",
   Narozeniny: "🎂",
   Nastavení: "⚙️"
};





export async function createInitialHelpMenu(client) {
    const commandsPath = path.join(__dirname, "../../commands");
    const categoryDirs = (
        await fs.readdir(commandsPath, { withFileTypes: true })
    )
        .filter((dirent) => dirent.isDirectory())
        .map((dirent) => dirent.name)
        .sort();

    const options = [
        {
            label: "📋 Všechny příkazy",
            description: "Zobrazit všechny dostupné příkazy",
            value: ALL_COMMANDS_ID,
        },
        ...categoryDirs.map((category) => {
            const categoryName =
                category.charAt(0).toUpperCase() +
                category.slice(1).toLowerCase();
            const icon = CATEGORY_ICONS[categoryName] || "🔍";
            return {
                label: `${icon} ${categoryName}`,
                description: `Zobrazit příkazy v kategorii ${categoryName}`,
                value: category,
            };
        }),
    ];

    const botName = client?.user?.username || "Bot";
    const embed = createEmbed({
  title: `🤖 ${botName}`,
  description: "Jsem tu pro moderaci, ekonomiku, zábavu a správu serveru.",
  color: 'primary'
});

embed.addFields(
  {
    name: "🛡️ **Moderace**",
    value: "Nástroje pro správu členů a udržování pořádku na serveru.",
    inline: true
},
{
    name: "💰 **Ekonomika**",
    value: "Virtuální měna, obchodování a ekonomické funkce.",
    inline: true
},
{
    name: "🎮 **Zábava**",
    value: "Hry, interaktivní příkazy, minecraft eventy a zábavné funkce.",
    inline: true
},
{
    name: "📈 **Leveling**",
    value: "XP systém, úrovně a odměny za aktivitu.",
    inline: true
},
{
    name: "🎫 **Tickety**",
    value: "Přehledná komunikace s A-TEAMEM pomocí ticketu.",
    inline: true
},
{
    name: "🎉 **Soutěže**",
    value: "Vytváření a správa giveaway soutěží.",
    inline: true
},
{
    name: "👋 **Uvítání**",
    value: "Automatické uvítání nových členů.",
    inline: true
},
{
    name: "🎂 **Narozeniny**",
    value: "Připomenutí narozenin vybraných členů členů.",
    inline: true
},
{
    name: "👥 **Komunita**",
    value: "Přihlášky, komunitní funkce a zapojení členů.",
    inline: true
},
{
    name: "⚙️ **Nastavení**",
    value: "Správa konfigurace serveru a bota.",
    inline: true
},
{
    name: "🔢 **Počítadla**",
    value: "Dynamická počítadla pro statistiky serveru.",
    inline: true
},
{
    name: "🎙️ **Join to Create**",
    value: "Automatické vytváření soukromých hlasových místností.",
    inline: true
},
{
    name: "🎭 **Reakční role**",
    value: "Výběr rolí pomocí reakcí nebo menu.",
    inline: true
},
{
    name: "✅ **Ověření**",
    value: "Ověřovací systémy pro zabezpečení serveru.",
    inline: true
},
{
    name: "🔧 **Nástroje**",
    value: "Praktické příkazy pro každodenní použití.",
    inline: true
}
);

    embed.setFooter({ 
        text: "Help | Farcikův Vesmír" 
    });
    embed.setTimestamp();

    const bugReportButton = new ButtonBuilder()
        .setCustomId(BUG_REPORT_BUTTON_ID)
        .setLabel("Nahlásit chybu")
        .setStyle(ButtonStyle.Danger);

    const ticketButton = new ButtonBuilder()
        .setLabel("🎟️ TICKET SYSTÉM")
        .setURL("https://discord.com/channels/1429032922446430422/1429485456667443220")
        .setStyle(ButtonStyle.Link);

    const youtubeButton = new ButtonBuilder()
        .setLabel("Farcikův YouTube kanál")
        .setURL("https://www.youtube.com/@NotFarc1k")
        .setStyle(ButtonStyle.Link);

    const selectRow = createSelectMenu(
        CATEGORY_SELECT_ID,
        "Klikni pro zobrazení příkazů",
        options,
    );

    const buttonRow = new ActionRowBuilder().addComponents([
        bugReportButton,
        ticketButton,
        youtubeButton,
    ]);

    return {
        embeds: [embed],
        components: [buttonRow, selectRow],
    };
}

export default {
    data: new SlashCommandBuilder()
        .setName("help")
        .setDescription("Zobrazí interaktivní menu s informacemi o příkazech a funkcích bota."),

    async execute(interaction, guildConfig, client) {
        
        const { MessageFlags } = await import('discord.js');
        await InteractionHelper.safeDefer(interaction);
        
        const { embeds, components } = await createInitialHelpMenu(client);

        await InteractionHelper.safeEditReply(interaction, {
            embeds,
            components,
        });

        setTimeout(async () => {
            try {
                const closedEmbed = createEmbed({
                    title: "⏰ HELP MENU UZAVŘENO",
                    description: "Help menu se uzavřelo, použij /help znovu.",
                    color: "secondary",
                });

                await InteractionHelper.safeEditReply(interaction, {
                    embeds: [closedEmbed],
                    components: [],
                });
            } catch (error) {
                
            }
        }, HELP_MENU_TIMEOUT_MS);
    },
};


