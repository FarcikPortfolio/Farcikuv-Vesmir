import { SlashCommandBuilder, PermissionFlagsBits, ChannelType } from 'discord.js';
import { errorEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

import dashboard from './modules/logging_dashboard.js';
import setchannel from './modules/logging_setchannel.js';
import filter from './modules/logging_filter.js';

export default {
    data: new SlashCommandBuilder()
        .setName('logging')
        .setDescription('Spravovat nastavení protokolování pro tento server.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .setDMPermission(false)
        .addSubcommand((subcommand) =>
            subcommand
                .setName('dashboard')
                .setDescription('Otevřít interaktivní nástěnku pro správu protokolování.'),
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName('setchannel')
                .setDescription('Nastavit textový kanál pro auditní protokolování, nebo jej zakázat.')
                .addChannelOption((option) =>
                    option
                        .setName('channel')
                        .setDescription('Kanál, který chcete nastavit pro auditní protokolování.')
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(false),
                )
                .addBooleanOption((option) =>
                    option
                        .setName('disable')
                        .setDescription('Nastavit auditní protokolování na žádný kanál.')
                        .setRequired(false),
                ),
        )
        .addSubcommandGroup((group) =>
            group
                .setName('filter')
                .setDescription('Spravovat seznam ignorovaných protokolů.')
                .addSubcommand((subcommand) =>
                    subcommand
                        .setName('add')
                        .setDescription('Přidat uživatele nebo kanál do seznamu ignorovaných protokolů.')
                        .addStringOption((option) =>
                            option
                                .setName('type')
                                .setDescription('Zda ignorovat uživatele nebo kanál.')
                                .setRequired(true)
                                .addChoices(
                                    { name: 'User', value: 'user' },
                                    { name: 'Channel', value: 'channel' },
                                ),
                        )
                        .addStringOption((option) =>
                            option
                                .setName('id')
                                .setDescription('ID uživatele, který chcete přidat do seznamu ignorovaných protokolů.')
                                .setRequired(true),
                        ),
                )
                .addSubcommand((subcommand) =>
                    subcommand
                        .setName('remove')
                        .setDescription('Odstranit uživatele nebo kanál ze seznamu ignorovaných protokolů.')
                        .addStringOption((option) =>
                            option
                                .setName('type')
                                .setDescription('Zda odstranit uživatele nebo kanál.')
                                .setRequired(true)
                                .addChoices(
                                    { name: 'User', value: 'user' },
                                    { name: 'Channel', value: 'channel' },
                                ),
                        )
                        .addStringOption((option) =>
                            option
                                .setName('id')
                                .setDescription('ID uživatele, který chcete odstranit ze seznamu ignorovaných protokolů.')
                                .setRequired(true),
                        ),
                ),
        ),

    async execute(interaction, config, client) {
        try {
            // setchannel and filter both need a reply deferred before their logic runs
            const subcommandGroup = interaction.options.getSubcommandGroup(false);
            const subcommand = interaction.options.getSubcommand();

            if (subcommand === 'dashboard') {
                return await dashboard.execute(interaction, config, client);
            }

            await InteractionHelper.safeDefer(interaction);

            if (subcommand === 'setchannel') {
                return await setchannel.execute(interaction, config, client);
            }

            if (subcommandGroup === 'filter') {
                return await filter.execute(interaction, config, client);
            }

            await InteractionHelper.safeEditReply(interaction, {
                embeds: [errorEmbed('Unknown Subcommand', 'This subcommand is not recognised.')],
            });
        } catch (error) {
            logger.error('logging command error:', error);
            await InteractionHelper.safeReply(interaction, {
                embeds: [errorEmbed('Error', 'An unexpected error occurred.')],
                ephemeral: true,
            }).catch(() => {});
        }
    },
};
