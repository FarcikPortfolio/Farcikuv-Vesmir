import { getColor } from '../../../config/bot.js';
import { PermissionFlagsBits } from 'discord.js';
import { createEmbed, errorEmbed } from '../../../utils/embeds.js';
import { getServerCounters, saveServerCounters, getCounterEmoji as getCounterTypeEmoji, getCounterTypeLabel, getGuildCounterStats } from '../../../services/serverstatsService.js';
import { logger } from '../../../utils/logger.js';






import { InteractionHelper } from '../../../utils/interactionHelper.js';
export async function handleList(interaction, client) {
    const guild = interaction.guild;
    
    // Defer reply immediately to ensure interaction is acknowledged
    try {
        await InteractionHelper.safeDefer(interaction);
    } catch (error) {
        logger.error("Failed to defer reply:", error);
        return;
    }
    
    // Check permissions after deferring
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
        await InteractionHelper.safeEditReply(interaction, { 
            embeds: [errorEmbed("You need **Manage Channels** permission to view counters.")]
        }).catch(logger.error);
        return;
    }

    try {
        const counters = await getServerCounters(client, guild.id);
        const stats = await getGuildCounterStats(guild);

        // Clean up counters with deleted channels
        const validCounters = [];
        const orphanedCounters = [];
        
        for (const counter of counters) {
            const channel = guild.channels.cache.get(counter.channelId);
            if (channel) {
                validCounters.push(counter);
            } else {
                orphanedCounters.push(counter);
                logger.info(`Removing orphaned counter ${counter.id} (type: ${counter.type}, deleted channel: ${counter.channelId}) from guild ${guild.id}`);
            }
        }
        
        // Save cleaned counters if any were orphaned
        if (orphanedCounters.length > 0) {
            await saveServerCounters(client, guild.id, validCounters);
            logger.info(`Cleaned up ${orphanedCounters.length} orphaned counter(s) from guild ${guild.id}`);
        }

        if (validCounters.length === 0) {
            const embed = createEmbed({
                title: "📋 Server Counters",
                description: "No counters have been set up for this server yet.\n\nUse `/counter create` to set up your first counter!",
                color: getColor('warning')
            });

            embed.addFields({
                name: "🔧 **Dostupné typy počítadel**",
                value: "👥 **Členi + Bots** - Celkový počet členů serveru\n👤 **Pouze členové** - Pouze lidské členy\n🤖 **Pouze boti** - Pouze boti\n🚀 **Boosteři** - Pouze nitro boostery",
                inline: false
            });

            embed.addFields({
                name: "📝 **Příklady použití**",
                value: "`/counter create type:members channel_type:voice category:Stats`\n`/counter create type:bots channel_type:text category:Server Info`\n`/counter list`",
                inline: false
            });

            embed.setFooter({ 
                text: "System počítadel • Automatické aktualizace každých 15 minut" 
            });

            await InteractionHelper.safeEditReply(interaction, { embeds: [embed] }).catch(logger.error);
            return;
        }

        const embed = createEmbed({
            title: `📋 Server Počítadla (${validCounters.length})`,
            description: "Zde jsou všechna nastavená počítadla pro tento server. Každé počítadlo se automaticky aktualizuje každých 15 minut.",
            color: getColor('info')
        });

        for (let i = 0; i < validCounters.length; i++) {
            const counter = validCounters[i];
            const channel = guild.channels.cache.get(counter.channelId);
            
            if (!channel) {
                // This should not happen since we filtered above, but keep as safety check
                logger.warn(`Counter ${counter.id} still has missing channel after cleanup`);
                continue;
            }

            const currentCount = getCurrentCount(stats, counter.type);
            const status = channel.name.includes(':') ? '✅ Active' : '⚠️ Not Updated';
            
            embed.addFields({
                name: `${getCounterTypeEmoji(counter.type)} Counter #${i + 1} - ${channel.name}`,
                value: `**ID:** \`${counter.id}\`\n**Type:** ${getCounterTypeDisplay(counter.type)}\n**Channel:** ${channel}\n**Current Count:** ${currentCount}\n**Status:** ${status}\n**Created:** ${new Date(counter.createdAt).toLocaleDateString()}`,
                inline: false
            });
        }

        embed.addFields({
            name: "📊 **Statistiky**",
            value: `**Celkové počítadla:** ${validCounters.length}\n**Aktivní počítadla:** ${validCounters.filter(c => {
                const channel = guild.channels.cache.get(c.channelId);
                return channel && channel.name.includes(':');
            }).length}\n**Next Update:** <t:${Math.floor(Date.now() / 1000) + 900}:R>`,
            inline: false
        });

        embed.addFields({
            name: "🔧 **Příkazy správy**",
            value: "`/counter create` - Vytvořit nové počítadlo\n`/counter update` - Aktualizovat existující počítadlo\n`/counter delete` - Smazat počítadlo",
            inline: false
        });

        embed.setFooter({ 
            text: "System počítadel • Automatické aktualizace každých 15 minut" 
        });
        embed.setTimestamp();

        await InteractionHelper.safeEditReply(interaction, { embeds: [embed] }).catch(logger.error);

    } catch (error) {
        logger.error("Error displaying counters:", error);
        await InteractionHelper.safeEditReply(interaction, {
            embeds: [errorEmbed("An error occurred while fetching counters. Please try again.")]
        }).catch(logger.error);
    }
}






function getCounterTypeDisplay(type) {
    return `${getCounterTypeEmoji(type)} ${getCounterTypeLabel(type)}`;
}






function getCounterEmoji(type) {
    return getCounterTypeEmoji(type);
}







function getCurrentCount(stats, type) {
    switch (type) {
        case "members":
            return stats.totalCount;
        case "bots":
            return stats.botCount;
        case "members_only":
            return stats.humanCount;
        case "boosters":
            return stats.boosterCount;
        default:
            return 0;
    }
}



