import { getColor } from '../../config/bot.js';
import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags, ChannelType } from 'discord.js';
import { createEmbed, errorEmbed, successEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';

import { handleCreate } from './modules/serverstats_create.js';
import { handleList } from './modules/serverstats_list.js';
import { handleUpdate } from './modules/serverstats_update.js';
import { handleDelete } from './modules/serverstats_delete.js';

import { InteractionHelper } from '../../utils/interactionHelper.js';
export default {
    data: new SlashCommandBuilder()
        .setName("serverstats")
        .setDescription("Manage server statistics that track member counts and channel data")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
        .addSubcommand(subcommand =>
            subcommand
                .setName("create")
                .setDescription("Vytvořit nový statistický tracker pro tento server")
                .addStringOption(option =>
                    option
                        .setName("type")
                        .setDescription("Typ trackeru, který chcete vytvořit")
                        .setRequired(true)
                        .addChoices(
                            { name: "členi + boti", value: "members" },
                            { name: "pouze členové", value: "members_only" },
                            { name: "pouze boti", value: "bots" },
                            { name: "boosteři", value: "boosters" }
                        )
                )
                .addStringOption(option =>
                    option
                        .setName("channel_type")
                        .setDescription("kanál pro tracker")
                        .setRequired(true)
                        .addChoices(
                            { name: "hlasový kanál (doporučeno)", value: "voice" },
                            { name: "textový kanál", value: "text" }
                        )
                )
                .addChannelOption(option =>
                    option
                        .setName("category")
                        .setDescription("Kategorie, do které bude tracker vytvořen")
                        .setRequired(true)
                        .addChannelTypes(ChannelType.GuildCategory)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName("list")
                .setDescription("Vypsat všechny existující statistické trackery pro tento server")
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName("update")
                .setDescription("Aktualizovat existující statistický tracker pro tento server")
                .addStringOption(option =>
                    option
                        .setName("counter-id")
                        .setDescription("ID trackeru, který chcete aktualizovat")
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option
                        .setName("type")
                        .setDescription("The new tracker type")
                        .setRequired(false)
                        .addChoices(
                            { name: "členi + boti", value: "members" },
                            { name: "pouze členové", value: "members_only" },
                            { name: "pouze boti", value: "bots" },
                            { name: "boosteři", value: "boosters" }
                        )
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName("delete")
                .setDescription("Smazat existující statistický tracker pro tento server")
                .addStringOption(option =>
                    option
                        .setName("counter-id")
                        .setDescription("ID trackeru, který chcete smazat")
                        .setRequired(true)
                )
        ),

    async execute(interaction, guildConfig, client) {
        const subcommand = interaction.options.getSubcommand();

        try {
            switch (subcommand) {
                case "create":
                    await handleCreate(interaction, client);
                    break;
                case "list":
                    await handleList(interaction, client);
                    break;
                case "update":
                    await handleUpdate(interaction, client);
                    break;
                case "delete":
                    await handleDelete(interaction, client);
                    break;
                default:
                    await InteractionHelper.safeReply(interaction, {
                        embeds: [errorEmbed("Unknown subcommand.")],
                        flags: MessageFlags.Ephemeral
                    });
            }
        } catch (error) {
            logger.error(`Error in serverstats ${subcommand}:`, error);
            
            const errorEmbedMsg = createEmbed({ 
                title: "❌ Error", 
                description: "An error occurred while processing your request.",
                color: getColor('error')
            });

            if (!interaction.replied && !interaction.deferred) {
                await InteractionHelper.safeReply(interaction, { embeds: [errorEmbedMsg], flags: MessageFlags.Ephemeral }).catch(logger.error);
            } else {
                await interaction.followUp({ embeds: [errorEmbedMsg], flags: MessageFlags.Ephemeral }).catch(logger.error);
            }
        }
    }
};




