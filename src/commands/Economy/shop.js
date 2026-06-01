import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { errorEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

import shopBrowse from './modules/shop_browse.js';
import shopConfigSetrole from './modules/shop_config_setrole.js';

export default {
    data: new SlashCommandBuilder()
        .setName('shop')
        .setDescription('Ekonomické příkazy obchodu.')
        .addSubcommand(subcommand =>
            subcommand
                .setName('browse')
                .setDescription('Prohlédněte si položky dostupné v obchodě.'),
        )
        .addSubcommandGroup(group =>
            group
                .setName('config')
                .setDescription('Konfigurace nastavení obchodu. (Požadováno oprávnění Manage Server)')
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('setrole')
                        .setDescription('Nastavte Discord roli udělenou při nákupu položky Premium Role.')
                        .addRoleOption(option =>
                            option
                                .setName('role')
                                .setDescription('Role, která bude udělena za nákup Premium Role.')
                                .setRequired(true),
                        ),
                ),
        ),

    async execute(interaction, config, client) {
        try {
            const subcommandGroup = interaction.options.getSubcommandGroup(false);
            const subcommand = interaction.options.getSubcommand();

            if (subcommand === 'browse') {
                return await shopBrowse.execute(interaction, config, client);
            }

            if (subcommandGroup === 'config' && subcommand === 'setrole') {
                return await shopConfigSetrole.execute(interaction, config, client);
            }

            return InteractionHelper.safeReply(interaction, {
                embeds: [errorEmbed('Error', 'Neznámý podpříkaz.')],
                flags: MessageFlags.Ephemeral,
            });
        } catch (error) {
            logger.error('shop command error:', error);
            await InteractionHelper.safeReply(interaction, {
                content: '❌ Chyba při zpracování příkazu. Zkuste to prosím znovu později.',
                flags: MessageFlags.Ephemeral,
            }).catch(() => {});
        }
    },
};