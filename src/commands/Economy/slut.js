import { SlashCommandBuilder } from 'discord.js';
import { createEmbed } from '../../utils/embeds.js';
import { getEconomyData, setEconomyData } from '../../utils/economy.js';
import { withErrorHandling, createError, ErrorTypes } from '../../utils/errorHandler.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

const SLUT_COOLDOWN = 45 * 60 * 1000;

const SLUT_ACTIVITIES = [
    { name: "Cam Stream", min: 120, max: 450, risk: 0.2 },
    { name: "Soukromá taneční lekce", min: 220, max: 700, risk: 0.25 },
    { name: "Afterparty", min: 320, max: 900, risk: 0.3 },
    { name: "VIP společnice", min: 550, max: 1400, risk: 0.35 },
    { name: "Exkluzivní livestream", min: 850, max: 2200, risk: 0.4 },
];

const POSITIVE_OUTCOMES = [
    "Tvůj stream se rozjel a diváci posílali spoustu donatů.",
    "VIP rezervace zaplatila výrazně nad průměr.",
    "Tvoje směna po zavíračce byla plná a velmi výdělečná.",
    "Přišlo několik prémiových zakázek a tvoje výplata výrazně vzrostla.",
];

const FINE_OUTCOMES = [
    "Ochranka podniku ti udělila pokutu za porušení pravidel.",
    "Moderátor platformy ti udělil poplatek za porušení podmínek.",
    "Byl jsi nahlášen a musel jsi zaplatit pokutu.",
];

const ROBBED_OUTCOMES = [
    "Falešný zákazník tě okradl o část výdělku.",
    "Podvodná rezervace ti vysála část peněz.",
    "Nalákal tě podvodný účet a přišel jsi o peníze.",
];

const LOSS_OUTCOMES = [
    "Akce propadla a musel jsi zaplatit provozní náklady.",
    "Utratil jsi příliš mnoho za přípravu a nic se nevrátilo.",
    "Směna se nepovedla a skončil jsi ve ztrátě.",
];

function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomChoice(items) {
    return items[Math.floor(Math.random() * items.length)];
}

function resolveOutcome(activity, wallet) {
    const successChance = Math.max(0.35, 0.55 - activity.risk * 0.2);
    const fineChance = 0.22;
    const robbedChance = 0.2;
    const roll = Math.random();

    if (roll < successChance) {
        const amount = randomInt(activity.min, activity.max);
        return {
            type: 'payout',
            delta: amount,
            message: randomChoice(POSITIVE_OUTCOMES),
            title: `💰 ${activity.name} - Výplata`
        };
    }

    const remainingAfterSuccess = roll - successChance;

    if (remainingAfterSuccess < fineChance) {
        const maxFine = Math.min(wallet, Math.max(150, Math.floor(activity.max * 0.4)));
        const minFine = Math.min(maxFine, Math.max(50, Math.floor(activity.min * 0.2)));
        const amount = maxFine > 0 ? randomInt(minFine, maxFine) : 0;
        return {
            type: 'fine',
            delta: -amount,
            message: randomChoice(FINE_OUTCOMES),
            title: `🚨 ${activity.name} - Pokutován`
        };
    }

    if (remainingAfterSuccess < fineChance + robbedChance) {
        const maxRobbed = Math.min(wallet, Math.max(200, Math.floor(wallet * 0.35)));
        const minRobbed = Math.min(maxRobbed, Math.max(75, Math.floor(wallet * 0.1)));
        const amount = maxRobbed > 0 ? randomInt(minRobbed, maxRobbed) : 0;
        return {
            type: 'robbed',
            delta: -amount,
            message: randomChoice(ROBBED_OUTCOMES),
            title: `🕵️ ${activity.name} - Okraden`
        };
    }

    const maxLoss = Math.min(wallet, Math.max(100, Math.floor(activity.max * 0.3)));
    const minLoss = Math.min(maxLoss, Math.max(40, Math.floor(activity.min * 0.15)));
    const amount = maxLoss > 0 ? randomInt(minLoss, maxLoss) : 0;
    return {
        type: 'loss',
        delta: -amount,
        message: randomChoice(LOSS_OUTCOMES),
        title: `❌ ${activity.name} - Ztráta`
    };
}

export default {
    data: new SlashCommandBuilder()
        .setName('slut')
        .setDescription('Přijměte riskantní provokativní práci za náhodnou výplatu nebo ztrátu'),

    execute: withErrorHandling(async (interaction, config, client) => {
        const deferred = await InteractionHelper.safeDefer(interaction);
        if (!deferred) return;

            const userId = interaction.user.id;
            const guildId = interaction.guildId;
            const now = Date.now();

            logger.debug(`[ECONOMY] Slut command started for ${userId}`, { userId, guildId });

            const userData = await getEconomyData(client, guildId, userId);

            if (!userData) {
                throw createError(
                    "Selhání při načítání ekonomických dat",
                    ErrorTypes.DATABASE,
                    "selhání při načítání ekonomických dat. Prosím zkuste to později.",
                    { userId, guildId }
                );
            }

            const lastSlut = userData.lastSlut || 0;

            if (now - lastSlut < SLUT_COOLDOWN) {
                const remainingTime = lastSlut + SLUT_COOLDOWN - now;
                throw createError(
                    "Slut cooldown active",
                    ErrorTypes.RATE_LIMIT,
                    `Musíte počkat, než budete moci znovu pracovat! Zkuste to znovu za **${Math.ceil(remainingTime / 60000)}** minut.`,
                    { timeRemaining: remainingTime, cooldownType: 'slut' }
                );
            }

            const activity = randomChoice(SLUT_ACTIVITIES);

            const outcome = resolveOutcome(activity, userData.wallet || 0);

            userData.lastSlut = now;
            userData.totalSluts = (userData.totalSluts || 0) + 1;
            userData.totalSlutEarnings = (userData.totalSlutEarnings || 0) + Math.max(0, outcome.delta);
            userData.totalSlutLosses = (userData.totalSlutLosses || 0) + Math.max(0, -outcome.delta);

            if (outcome.type !== 'payout') {
                userData.failedSluts = (userData.failedSluts || 0) + 1;
            }

            userData.wallet = Math.max(0, (userData.wallet || 0) + outcome.delta);

            await setEconomyData(client, guildId, userId, userData);

            logger.info(`[ECONOMY_TRANSACTION] Slut activity resolved`, {
                userId,
                guildId,
                activity: activity.name,
                outcomeType: outcome.type,
                amountDelta: outcome.delta,
                newWallet: userData.wallet,
                timestamp: new Date().toISOString()
            });

            const amountLabel = `${outcome.delta >= 0 ? '+' : '-'}$${Math.abs(outcome.delta).toLocaleString()}`;
            const summaryLines = [
                `${outcome.message}`,
                `💸 **Čistý výsledek:** ${amountLabel}`,
                `💳 **Aktuální zůstatek:** $${userData.wallet.toLocaleString()}`,
                `📊 **Celkem relací:** ${userData.totalSluts}`,
                `💵 **Celkem vydělán:** $${(userData.totalSlutEarnings || 0).toLocaleString()}`,
                `🧾 **Celkem ztraceno:** $${(userData.totalSlutLosses || 0).toLocaleString()}`
            ];

            const embed = createEmbed({
                title: outcome.title,
                description: summaryLines.join('\n'),
                color: outcome.delta >= 0 ? 'success' : 'error',
                timestamp: true
            });

            await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
    }, { command: 'slut' })
};





