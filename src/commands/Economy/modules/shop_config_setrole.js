import { PermissionsBitField } from 'discord.js';
import { errorEmbed, successEmbed } from '../../../utils/embeds.js';
import { getGuildConfig, setGuildConfig } from '../../../services/guildConfig.js';
import { InteractionHelper } from '../../../utils/interactionHelper.js';
import { logger } from '../../../utils/logger.js';

export default {
    async execute(interaction, config, client) {
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
            return InteractionHelper.safeReply(interaction, {
                embeds: [errorEmbed('Permission Denied', 'Potřebujete oprávnění **Manage Server** pro nastavení premium role.')],
                ephemeral: true,
            });
        }

        const role = interaction.options.getRole('role');
        const guildId = interaction.guildId;

        try {
            const currentConfig = await getGuildConfig(client, guildId);
            currentConfig.premiumRoleId = role.id;
            await setGuildConfig(client, guildId, currentConfig);

            return InteractionHelper.safeReply(interaction, {
                embeds: [successEmbed('✅ Premium Role Nastavena', `Premium role byla nastavena na ${role.toString()}. Uživatelé, kteří si koupí položku Premium Role, obdrží tuto roli.`)],
                ephemeral: true,
            });
        } catch (error) {
            logger.error('shop_config_setrole error:', error);
            return InteractionHelper.safeReply(interaction, {
                embeds: [errorEmbed('System Error', 'Nepodařilo se uložit konfiguraci guildy.')],
                ephemeral: true,
            });
        }
    },
};
