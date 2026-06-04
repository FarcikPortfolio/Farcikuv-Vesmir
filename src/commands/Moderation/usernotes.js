import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { createEmbed, errorEmbed, successEmbed, infoEmbed, warningEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { getFromDb, setInDb, deleteFromDb } from '../../utils/database.js';
import { sanitizeInput } from '../../utils/sanitization.js';






import { InteractionHelper } from '../../utils/interactionHelper.js';
function getUserNotesKey(guildId, userId) {
    return `moderation_user_notes_${guildId}_${userId}`;
}






function getGuildNotesListKey(guildId) {
    return `moderation_user_notes_list_${guildId}`;
}

export default {
    data: new SlashCommandBuilder()
        .setName("usernotes")
        .setDescription("Manage user notes for moderation purposes")
        .addSubcommand(subcommand =>
            subcommand
                .setName("add")
                .setDescription("Přidat poznámku pro uživatele")
                .addUserOption(option =>
                    option
                        .setName("target")
                        .setDescription("Uživatel, kterému chcete přidat poznámku")
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option
                        .setName("note")
                        .setDescription("Poznámka, kterou chcete přidat (max 1000 znaků)")
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option
                        .setName("type")
                        .setDescription("Typ poznámky")
                        .addChoices(
                            { name: "Varování", value: "warning" },
                            { name: "Pozitivní", value: "positive" },
                            { name: "Neutrální", value: "neutral" },
                            { name: "Upozornění", value: "alert" }
                        )
                        .setRequired(false)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName("view")
                .setDescription("Zobrazit poznámky o uživateli")
                .addUserOption(option =>
                    option
                        .setName("target")
                        .setDescription("Uživatel, jehož poznámky chcete zobrazit")
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName("remove")
                .setDescription("Odebrat konkrétní poznámku o uživateli")
                .addUserOption(option =>
                    option
                        .setName("target")
                        .setDescription("Uživatel, od kterého chcete odebrat poznámku")
                        .setRequired(true)
                )
                .addIntegerOption(option =>
                    option
                        .setName("index")
                        .setDescription("Index poznámky, kterou chcete odebrat")
                        .setRequired(true)
                        .setMinValue(1)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName("clear")
                .setDescription("Smazat všechny poznámky o uživateli")
                .addUserOption(option =>
                    option
                        .setName("target")
                        .setDescription("Uživatel, jehož poznámky chcete smazat")
                        .setRequired(true)
                )
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
    category: "moderation",

    async execute(interaction, config, client) {
        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
            return InteractionHelper.safeReply(interaction, {
                embeds: [
                    errorEmbed(
                        "Oprávnění zamítnuto",
                        "Nemáte oprávnění k správě zpráv pro použití tohoto příkazu."
                    ),
                ],
            });
        }

        const subcommand = interaction.options.getSubcommand();
        const targetUser = interaction.options.getUser("target");
        const guildId = interaction.guild.id;

        if (subcommand !== "view" && subcommand !== "remove" && subcommand !== "clear" && subcommand !== "add") {
            return InteractionHelper.safeReply(interaction, {
                embeds: [
                    errorEmbed(
                        "Neplatný podpříkaz",
                        "Prosím vyberte platný podpříkaz."
                    ),
                ],
            });
        }

        let notes = [];
        if (targetUser) {
            const notesKey = getUserNotesKey(guildId, targetUser.id);
            notes = await getFromDb(notesKey, []);
        }

        try {
            switch (subcommand) {
                case "add":
                    return await handleAddNote(interaction, targetUser, notes, guildId);
                case "view":
                    return await handleViewNotes(interaction, targetUser, notes);
                case "remove":
                    return await handleRemoveNote(interaction, targetUser, notes, guildId);
                case "clear":
                    return await handleClearNotes(interaction, targetUser, notes, guildId);
                default:
                    return InteractionHelper.safeReply(interaction, {
                        embeds: [
                            errorEmbed(
                                "Neplatný podpříkaz",
                                "Prosím vyberte platný podpříkaz."
                            ),
                        ],
                    });
            }
        } catch (error) {
            logger.error(`Error in usernotes command (${subcommand}):`, error);
            return InteractionHelper.safeReply(interaction, {
                embeds: [
                    errorEmbed(
                        "System Error",
                        "An error occurred while processing your request. Please try again later."
                    ),
                ],
                flags: MessageFlags.Ephemeral
            });
        }
    }
};

async function handleAddNote(interaction, targetUser, notes, guildId) {
    let note = interaction.options.getString("note").trim();
    const type = interaction.options.getString("type") || "neutral";

    if (note.length > 1000) {
        return InteractionHelper.safeReply(interaction, {
            embeds: [
                errorEmbed(
                    "Note Too Long",
                    "Notes must be 1000 characters or less."
                ),
            ],
        });
    }

    if (note.length === 0) {
        return InteractionHelper.safeReply(interaction, {
            embeds: [
                errorEmbed(
                    "Empty Note",
                    "Note cannot be empty."
                ),
            ],
        });
    }

    
    note = sanitizeInput(note);

    const noteData = {
        id: Date.now(),
        content: note,
        type: type,
        author: interaction.user.tag,
        authorId: interaction.user.id,
        timestamp: new Date().toISOString()
    };

    notes.push(noteData);

    const notesKey = getUserNotesKey(guildId, targetUser.id);
    await setInDb(notesKey, notes);

    const typeInfo = getNoteTypeInfo(type);

    return InteractionHelper.safeReply(interaction, {
        embeds: [
            successEmbed(
                `${typeInfo.emoji} Note Added`,
                `Added a **${type}** note for **${targetUser.tag}**:\n\n` +
                `> ${note}\n\n` +
                `**Moderator:** ${interaction.user.tag}\n` +
                `**Total Notes:** ${notes.length}`
            )
        ]
    });
}

async function handleViewNotes(interaction, targetUser, notes) {
    if (notes.length === 0) {
        return InteractionHelper.safeReply(interaction, {
            embeds: [
                infoEmbed(
                    "📝 No Notes",
                    `There are no notes for **${targetUser.tag}**.`
                ),
            ],
        });
    }

    const sortedNotes = [...notes].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    let description = `**Notes for ${targetUser.tag} (${targetUser.id}):**\n\n`;
    
    sortedNotes.forEach((note, index) => {
        const typeInfo = getNoteTypeInfo(note.type);
        const date = new Date(note.timestamp).toLocaleDateString();
        description += `${typeInfo.emoji} **Note #${index + 1}** (${note.type}) - ${date}\n`;
        description += `> ${note.content}\n`;
        description += `*Added by ${note.author}*\n\n`;
    });

    if (description.length > 4000) {
        description = description.substring(0, 3900) + "\n... *(truncated)*";
    }

    return InteractionHelper.safeReply(interaction, {
        embeds: [
            infoEmbed(
                `📝 User Notes (${notes.length})`,
                description
            )
        ]
    });
}

async function handleRemoveNote(interaction, targetUser, notes, guildId) {
const index = interaction.options.getInteger("index") - 1;

    if (index < 0 || index >= notes.length) {
        return InteractionHelper.safeReply(interaction, {
            embeds: [
                errorEmbed(
                    "Invalid Index",
                    `Please provide a valid note index (1-${notes.length}).`
                ),
            ],
        });
    }

    const removedNote = notes[index];
    notes.splice(index, 1);

    const notesKey = getUserNotesKey(guildId, targetUser.id);
    await setInDb(notesKey, notes);

    const typeInfo = getNoteTypeInfo(removedNote.type);

    return InteractionHelper.safeReply(interaction, {
        embeds: [
            successEmbed(
                `${typeInfo.emoji} Note Removed`,
                `Removed note #${index + 1} from **${targetUser.tag}**:\n\n` +
                `> ${removedNote.content}\n\n` +
                `**Remaining Notes:** ${notes.length}`
            )
        ]
    });
}

async function handleClearNotes(interaction, targetUser, notes, guildId) {
    const noteCount = notes.length;
    
    if (noteCount === 0) {
        return InteractionHelper.safeReply(interaction, {
            embeds: [
                infoEmbed(
                    "No Notes to Clear",
                    `There are no notes for **${targetUser.tag}** to clear.`
                ),
            ],
        });
    }

    notes.length = 0;

    const notesKey = getUserNotesKey(guildId, targetUser.id);
    await setInDb(notesKey, notes);

    return InteractionHelper.safeReply(interaction, {
        embeds: [
            successEmbed(
                "🗑️ Notes Cleared",
                `Cleared **${noteCount}** notes from **${targetUser.tag}**.`
            )
        ]
    });
}

function getNoteTypeInfo(type) {
    const types = {
        warning: { emoji: "⚠️", color: "#FF6B6B" },
        positive: { emoji: "✅", color: "#51CF66" },
        neutral: { emoji: "📝", color: "#74C0FC" },
        alert: { emoji: "🚨", color: "#FFD43B" }
    };
    
    return types[type] || types.neutral;
}





