import { getGuildConfig } from './guildConfig.js';
import { getGuildBirthdays, setBirthday as dbSetBirthday, deleteBirthday as dbDeleteBirthday, getMonthName } from '../utils/database.js';
import { logger } from '../utils/logger.js';
import { ErwinBotError, ErrorTypes } from '../utils/errorHandler.js';







export function validateBirthday(month, day) {
  
  if (typeof month !== 'number' || typeof day !== 'number') {
    return {
      isValid: false,
      error: 'Month and day must be numbers'
    };
  }

  
  if (month < 1 || month > 12) {
    return {
      isValid: false,
      error: 'Month must be between 1 and 12'
    };
  }

  
  if (day < 1 || day > 31) {
    return {
      isValid: false,
      error: 'Day must be between 1 and 31'
    };
  }

  
  const currentYear = new Date().getFullYear();
  const date = new Date(currentYear, month - 1, day);
  
  if (isNaN(date.getTime()) || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return {
      isValid: false,
      error: 'Invalid date. Please check the month and day combination (e.g., February 29th only exists in leap years)'
    };
  }

  return { isValid: true };
}










export async function setBirthday(client, guildId, userId, month, day) {
  try {
    
    const validation = validateBirthday(month, day);
    if (!validation.isValid) {
      logger.warn('Birthday validation failed', {
        userId,
        guildId,
        month,
        day,
        error: validation.error
      });
      
      throw new ErwinBotError(
        validation.error,
        ErrorTypes.VALIDATION,
        validation.error,
        { month, day, userId, guildId }
      );
    }

    // Set birthday in database
    const success = await dbSetBirthday(client, guildId, userId, month, day);
    
    if (!success) {
      throw new ErwinBotError(
        'Failed to save birthday to database',
        ErrorTypes.DATABASE,
        'Failed to set your birthday. Please try again later.',
        { userId, guildId, month, day }
      );
    }

    logger.info('Birthday set successfully', {
      userId,
      guildId,
      month,
      day,
      monthName: getMonthName(month)
    });

    return {
      success: true,
      data: {
        month,
        day,
        monthName: getMonthName(month)
      }
    };
  } catch (error) {
    logger.error('Error in setBirthday service', {
      error: error.message,
      stack: error.stack,
      userId,
      guildId,
      month,
      day
    });
    
    throw error;
  }
}








/**
 * Retrieves a user's birthday, falling back to global database if not set in guild
 * @param {Object} client - Discord client
 * @param {string} guildId - Current guild ID
 * @param {string} userId - Target user ID
 * @returns {Promise<Object|null>} Birthday object with month, day, and monthName
 */
export async function getUserBirthday(client, guildId, userId) {
  try {
    // 1. Check guild-specific birthdays first
    const birthdays = await getGuildBirthdays(client, guildId);
    let birthdayData = birthdays[userId];
    
    // 2. Fallback to global birthday if not found in guild
    // This allows "automatic fetching" as soon as a user joins a new server
    if (!birthdayData) {
      const { getGlobalBirthday } = await import('../utils/database.js');
      birthdayData = await getGlobalBirthday(client, userId);
      
      if (birthdayData) {
        logger.info(`Automatically fetched global birthday for user ${userId} in guild ${guildId}`);
      }
    }

    if (!birthdayData) {
      return null;
    }

    return {
      month: birthdayData.month,
      day: birthdayData.day,
      monthName: getMonthName(birthdayData.month)
    };
  } catch (error) {
    logger.error('Error in getUserBirthday service', {
      error: error.message,
      userId,
      guildId
    });
    throw error;
  }
}







export async function getAllBirthdays(client, guildId) {
  try {
    const birthdays = await getGuildBirthdays(client, guildId);
    
    if (!birthdays || Object.keys(birthdays).length === 0) {
      return [];
    }

    
    const sortedBirthdays = Object.entries(birthdays)
      .map(([userId, data]) => ({
        userId,
        month: data.month,
        day: data.day,
        monthName: getMonthName(data.month)
      }))
      .sort((a, b) => {
        if (a.month !== b.month) return a.month - b.month;
        return a.day - b.day;
      });

    return sortedBirthdays;
  } catch (error) {
    logger.error('Error in getAllBirthdays service', {
      error: error.message,
      guildId
    });
    throw error;
  }
}








export async function deleteBirthday(client, guildId, userId) {
  try {
    
    const birthday = await getUserBirthday(client, guildId, userId);
    
    if (!birthday) {
      return {
        success: false,
        notFound: true,
        message: 'No birthday found to remove'
      };
    }

    const success = await dbDeleteBirthday(client, guildId, userId);
    
    if (!success) {
      throw new ErwinBotError(
        'Failed to delete birthday from database',
        ErrorTypes.DATABASE,
        'Failed to remove your birthday. Please try again.',
        { userId, guildId }
      );
    }

    logger.info('Birthday removed successfully', {
      userId,
      guildId
    });

    return {
      success: true,
      message: 'Birthday removed successfully'
    };
  } catch (error) {
    logger.error('Error in deleteBirthday service', {
      error: error.message,
      userId,
      guildId
    });
    throw error;
  }
}








export async function getUpcomingBirthdays(client, guildId, limit = 5) {
  try {
    const birthdays = await getGuildBirthdays(client, guildId);
    
    if (!birthdays || Object.keys(birthdays).length === 0) {
      return [];
    }

    const today = new Date();
    const currentYear = today.getFullYear();
    
    const upcomingBirthdays = [];
    
    for (const [userId, userData] of Object.entries(birthdays)) {
      let nextBirthday = new Date(currentYear, userData.month - 1, userData.day);
      
      
      if (nextBirthday < today) {
        nextBirthday = new Date(currentYear + 1, userData.month - 1, userData.day);
      }
      
      const daysUntil = Math.ceil((nextBirthday - today) / (1000 * 60 * 60 * 24));
      
      upcomingBirthdays.push({
        userId,
        month: userData.month,
        day: userData.day,
        monthName: getMonthName(userData.month),
        date: nextBirthday,
        daysUntil
      });
    }

    
    upcomingBirthdays.sort((a, b) => a.daysUntil - b.daysUntil);
    
    
    return upcomingBirthdays.slice(0, limit);
  } catch (error) {
    logger.error('Error in getUpcomingBirthdays service', {
      error: error.message,
      guildId,
      limit
    });
    throw error;
  }
}







export async function getTodaysBirthdays(client, guildId) {
  try {
    const birthdays = await getGuildBirthdays(client, guildId);
    const today = new Date();
    const currentMonth = today.getUTCMonth() + 1;
    const currentDay = today.getUTCDate();

    const todaysBirthdays = [];

    for (const [userId, userData] of Object.entries(birthdays)) {
      if (userData.month === currentMonth && userData.day === currentDay) {
        todaysBirthdays.push({
          userId,
          month: userData.month,
          day: userData.day,
          monthName: getMonthName(userData.month)
        });
      }
    }

    return todaysBirthdays;
  } catch (error) {
    logger.error('Error in getTodaysBirthdays service', {
      error: error.message,
      guildId
    });
    throw error;
  }
}





/**
 * Daily background task to check for birthdays and send announcements
 * @param {Object} client - Discord client
 */
export async function checkBirthdays(client) {
  const today = new Date();
  const currentMonth = today.getUTCMonth() + 1;
  const currentDay = today.getUTCDate();

  if (process.env.NODE_ENV !== 'production') {
    logger.debug(`🎂 Running daily birthday check for UTC: ${currentMonth}/${currentDay}.`);
  }

  for (const [guildId, guild] of client.guilds.cache) {
    try {
      const config = await getGuildConfig(client, guildId);
      const { birthdayChannelId, birthdayRoleId } = config;

      // Skip if no channel is configured
      if (!birthdayChannelId) {
        continue;
      }

      const channel = await guild.channels.fetch(birthdayChannelId).catch(() => null);
      if (!channel) continue;

      // Handle role management tracking
      const trackingKey = `bday-role-tracking-${guildId}`;
      const trackingData = (await client.db.get(trackingKey)) || {};
      const updatedTrackingData = { ...trackingData };
      
      // Remove expired birthday roles
      for (const userId of Object.keys(trackingData)) {
        try {
          const member = await guild.members.fetch(userId).catch(() => null);
          if (member && member.roles.cache.has(birthdayRoleId)) {
            await member.roles.remove(birthdayRoleId, "Birthday role expired");
          }
          delete updatedTrackingData[userId];
        } catch (error) {
           logger.error(`Error removing birthday role from ${userId}:`, error);
        }
      }

      if (Object.keys(updatedTrackingData).length !== Object.keys(trackingData).length) {
        await client.db.set(trackingKey, updatedTrackingData);
      }

      // Fetch birthdays for this guild
      const birthdaysKey = `guild:${guildId}:birthdays`; // Corrected key usage
      const birthdays = (await client.db.get(birthdaysKey)) || {};
      const birthdayMembers = [];

      for (const [userId, userData] of Object.entries(birthdays)) {
        if (userData.month === currentMonth && userData.day === currentDay) {
          const member = await guild.members.fetch(userId).catch(() => null);
          if (member) {
            birthdayMembers.push(member);
            
            // Add birthday role if configured
            if (birthdayRoleId) {
              try {
                await member.roles.add(birthdayRoleId, "Happy Birthday! 🎉");
                updatedTrackingData[userId] = true;
              } catch (error) {
                  logger.error(`Error adding birthday role to ${member.user.tag}:`, error);
              }
            }
          }
        }
      }

      // Send the announcement wish
      if (birthdayMembers.length > 0) {
        await client.db.set(trackingKey, updatedTrackingData);
        const mentionList = birthdayMembers.map(m => m.toString()).join(', ');
        const many = birthdayMembers.length > 1;
        
        await channel.send({
          content: `HEY ${mentionList}! 🎂`,
          embeds: [{
            title: '✨ A Special Celebration! ✨',
            description: `Today we celebrate the birth of ${many ? 'some amazing members' : 'a wonderful member'} of our community!\n\n**Happy Birthday ${mentionList}!**\n\nWishing you a day filled with joy, laughter, and plenty of cake! 🎁🎈`,
            color: 0xE91E63, // Premium Vivid Pink
            thumbnail: {
                url: birthdayMembers[0].user.displayAvatarURL({ dynamic: true })
            },
            fields: [
                {
                    name: '🎉 Community Wish',
                    value: `May your year ahead be as bright as your smile!`,
                    inline: false
                }
            ],
            footer: { 
                text: `${guild.name} • Birthday Celebration`,
                icon_url: guild.iconURL()
            },
            timestamp: new Date()
          }]
        });
      }
    } catch (error) {
      logger.error(`Error processing birthdays for guild ${guildId}:`, error);
    }
  }
}



