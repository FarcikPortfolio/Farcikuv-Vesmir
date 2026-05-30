import { logger } from './logger.js';

const DEFAULT_TEMPLATES = {
    welcome: 'Welcome {user} to {server}!',
    goodbye: '{user.tag} has left the server.'
};

function replaceAll(message, token, value) {
    if (value === undefined || value === null) {
        return message;
    }
    return message.split(token).join(String(value));
}






export function formatWelcomeMessage(message, data) {
    
    if (typeof message !== 'string') return '';
    if (!message) return '';
    if (!data || typeof data !== 'object') return message;

    const user = data?.user;
    const guild = data?.guild;

    
    if (!user || typeof user !== 'object') {
        logger.warn('Invalid user object passed to formatWelcomeMessage');
    }
    if (!guild || typeof guild !== 'object') {
        logger.warn('Invalid guild object passed to formatWelcomeMessage');
    }

    const tokens = {
    '{user}': user?.toString?.() || 'User',
    '{username}': user?.username || 'Unknown',
    '{usertag}': user?.tag || 'Unknown#0000',
    '{userid}': user?.id || 'Unknown',

    '{guildmembercount}': guild?.memberCount?.toString?.() || '0',
    '{memberCount}': guild?.memberCount?.toString?.() || '0',

    '{usercreatedat}': `<t:${Math.floor((user?.createdTimestamp || Date.now()) / 1000)}:F>`,
    '{usercreatedrelative}': `<t:${Math.floor((user?.createdTimestamp || Date.now()) / 1000)}:R>`,

    '{userjoinedat}': data?.member?.joinedTimestamp
        ? `<t:${Math.floor(data.member.joinedTimestamp / 1000)}:F>`
        : 'Unknown',

    '{userjoinedrelative}': data?.member?.joinedTimestamp
        ? `<t:${Math.floor(data.member.joinedTimestamp / 1000)}:R>`
        : 'Unknown',

    '{server}': guild?.name || 'Server',
    '{server.name}': guild?.name || 'Server',
    '{guild.name}': guild?.name || 'Server',
    '{guild.id}': guild?.id || 'unknown'
};

    let result = message;

for (const [token, value] of Object.entries(tokens)) {
    if (value === undefined || value === null) continue;
    result = replaceAll(result, token, String(value));
}

result = result.replace(/\\n/g, '\n');

return result;
}

export function getDefaultWelcomeMessage() {
    return DEFAULT_TEMPLATES.welcome;
}

export function getDefaultGoodbyeMessage() {
    return DEFAULT_TEMPLATES.goodbye;
}


