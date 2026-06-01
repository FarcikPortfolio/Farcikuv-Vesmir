import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { createEmbed, errorEmbed, successEmbed, infoEmbed, warningEmbed } from '../../utils/embeds.js';
import { shopItems } from '../../config/shop/items.js';
import { getEconomyData } from '../../utils/economy.js';
import { withErrorHandling, createError, ErrorTypes } from '../../utils/errorHandler.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

const SHOP_ITEMS = shopItems;

export default {
    data: new SlashCommandBuilder()
        .setName('inventory')
        .setDescription('Zobrazí položky ve tvém inventáři.'),

    execute: withErrorHandling(async (interaction, config, client) => {
        const deferred = await InteractionHelper.safeDefer(interaction);
        if (!deferred) return;

            const userId = interaction.user.id;
            const guildId = interaction.guildId;

            logger.debug(`[ECONOMY] Požadavek na inventář uživatele ${userId}`, { userId, guildId });

            const userData = await getEconomyData(client, guildId, userId);

            if (!userData) {
                throw createError(
                    "Selhání při načítání ekonomických dat",
                    ErrorTypes.DATABASE,
                    "Selhání při načítání ekonomických dat. Prosím zkuste to později.",
                    { userId, guildId }
                );
            }

            const inventory = userData.inventory || {};

            let inventoryDescription = "Tvůj inventář je momentálně prázdný.";

            if (Object.keys(inventory).length > 0) {
                inventoryDescription = Object.entries(inventory)
                    .filter(
                        ([itemId, quantity]) => {
                            const item = SHOP_ITEMS.find(i => i.id === itemId);
                            return quantity > 0 && item;
                        }
                    )
                    .map(
                        ([itemId, quantity]) => {
                            const item = SHOP_ITEMS.find(i => i.id === itemId);
                            return `**${item.name}:** ${quantity}x`;
                        }
                    )
                    .join("\n");
            }

            logger.info(`[ECONOMY] inventář načtený`, { 
                userId, 
                guildId,
                itemCount: Object.keys(inventory).length
            });

            const embed = createEmbed({ 
                title: `📦 ${interaction.user.username} Inventář`, 
                description: inventoryDescription, 
            }).setThumbnail(interaction.user.displayAvatarURL());

            await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
    }, { command: 'inventory' })
};




