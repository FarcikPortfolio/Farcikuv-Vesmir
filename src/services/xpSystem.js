



import { logger } from '../utils/logger.js';
import { getLevelingConfig, getXpForLevel, getUserLevelData, saveUserLevelData } from './leveling.js';
import { logEvent, EVENT_TYPES } from './loggingService.js';
import { Mutex } from '../utils/mutex.js';









export async function addXp(client, guild, member, xpToAdd) {
  const lockKey = `leveling:${guild.id}:${member.user.id}`;
  return await Mutex.runExclusive(lockKey, async () => {
    try {
      // XP Logic...
      if (!xpToAdd || xpToAdd <= 0) {
        return { success: false, reason: 'Invalid XP amount' };
      }

      const config = await getLevelingConfig(client, guild.id);
      
      if (!config.enabled) {
        return { success: false, reason: 'Leveling is disabled in this server' };
      }
      
      const levelData = await getUserLevelData(client, guild.id, member.user.id);
      
      levelData.xp += xpToAdd;
      levelData.totalXp += xpToAdd;
      levelData.lastMessage = Date.now();
      
      // Handle multi-level jumps
      let xpNeededForNextLevel = getXpForLevel(levelData.level);
      let didLevelUp = false;
      const initialLevel = levelData.level;

      while (levelData.xp >= xpNeededForNextLevel && levelData.level < 1000) {
        levelData.xp -= xpNeededForNextLevel;
        levelData.level += 1;
        didLevelUp = true;
        xpNeededForNextLevel = getXpForLevel(levelData.level);

        logger.info(`🎉 ${member.user.tag} leveled up to level ${levelData.level} in ${guild.name}`);

        // Award role rewards for each level if applicable
        if (config.roleRewards && config.roleRewards[levelData.level]) {
          await awardRoleReward(guild, member, config.roleRewards[levelData.level], levelData.level);
        }
      }

      if (didLevelUp) {
        // If they leveled up, we only announce once (to the highest level reached)
        if (config.announceLevelUp) {
          await sendLevelUpAnnouncement(guild, member, levelData, config);
        }

        // Log the levelup event (once for the highest level reached)
        try {
          await logEvent({
            client,
            guildId: guild.id,
            eventType: EVENT_TYPES.LEVELING_LEVELUP,
            data: {
              description: `${member.user.tag} reached level ${levelData.level}`,
              userId: member.user.id,
              fields: [
                {
                  name: '👤 Member',
                  value: `${member.user.tag} (${member.user.id})`,
                  inline: true
                },
                {
                  name: '📊 New Level',
                  value: levelData.level.toString(),
                  inline: true
                },
                {
                  name: '📈 Levels Gained',
                  value: (levelData.level - initialLevel).toString(),
                  inline: true
                },
                {
                  name: '✨ Total XP',
                  value: levelData.totalXp.toString(),
                  inline: true
                }
              ]
            }
          });
        } catch (logError) {
          logger.debug('Failed to log leveling event:', logError.message);
        }
      }
      
      await saveUserLevelData(client, guild.id, member.user.id, levelData);
      
      return {
        success: true,
        level: levelData.level,
        xp: levelData.xp,
        totalXp: levelData.totalXp,
        xpNeeded: getXpForLevel(levelData.level + 1),
        leveledUp: didLevelUp
      };
      
    } catch (error) {
      logger.error('Error adding XP:', error);
      return { success: false, error: error.message };
    }
  });
}










async function awardRoleReward(guild, member, roleId, level) {
  try {

    const levelRoles = {
      5: "1465776586652651550",
      10: "1465776112750825522",
      15: "1465776276697518080",
      25: "1465776297883209748",
      30: "1465776323690627084",
      35: "1465776346641727657",
      40: "1465776369446162608"
    };

    const role = guild.roles.cache.get(roleId);

    if (!role) {
      logger.warn(`Role ${roleId} not found`);
      return;
    }

    for (const rewardRoleId of Object.values(levelRoles)) {
      if (
        rewardRoleId !== roleId &&
        member.roles.cache.has(rewardRoleId)
      ) {
        await member.roles.remove(rewardRoleId);
      }
    }

    if (!member.roles.cache.has(roleId)) {
      await member.roles.add(role);
    }

    logger.info(
      `${member.user.tag} received level role ${role.name}`
    );

  } catch (error) {
    logger.error(
      'Failed to award level role:',
      error
    );
  }
}










async function sendLevelUpAnnouncement(guild, member, levelData, config) {
  try {
    const levelUpChannel = config.levelUpChannel 
      ? guild.channels.cache.get(config.levelUpChannel) 
      : guild.systemChannel;
    
    if (!levelUpChannel || !levelUpChannel.isTextBased()) {
      return;
    }

    
    const permissions = levelUpChannel.permissionsFor(guild.members.me);
    if (!permissions || !permissions.has(['SendMessages', 'EmbedLinks'])) {
      logger.warn(`Missing permissions to send levelup message in ${levelUpChannel.id}`);
      return;
    }

    const message = config.levelUpMessage
      .replace(/{user}/g, member.toString())
      .replace(/{level}/g, levelData.level)
      .replace(/{xp}/g, levelData.xp)
      .replace(/{xpNeeded}/g, getXpForLevel(levelData.level + 1));
    
    await levelUpChannel.send(message).catch(error => {
      logger.error(`Failed to send level up message in channel ${levelUpChannel.id}:`, error);
    });
  } catch (error) {
    logger.error('Error sending level up announcement:', error);
  }
}


