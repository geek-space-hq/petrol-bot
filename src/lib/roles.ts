import Discord from 'discord.js';

import { redis } from './redis';
import { resolveOrNull } from './resolver';

export async function getAllowedRoles(moduleName: string, guildId: string): Promise<string[]> {
  const roles = await resolveOrNull(redis.smembers(`${moduleName}/${guildId}/roles`));
  if (roles === null) {
    return [];
  }
  return roles;
}

export async function isAllowed(
  moduleName: string,
  author: Discord.GuildMember,
  guild: Discord.Guild,
): Promise<boolean> {
  if (author.id === guild.ownerID) {
    return true;
  }

  const roles = author.roles.cache;

  const allowedRoles = await getAllowedRoles(moduleName, guild.id);

  for (const role of roles) {
    if (role[1].permissions.has('ADMINISTRATOR')) {
      return true;
    }

    if (allowedRoles.includes(role[0])) {
      return true;
    }
  }

  return false;
}

export async function allowRole(moduleName: string, guild: Discord.Guild, roleId: string) {
  const guildId = guild.id;

  return (await redis.sadd(`${moduleName}/${guildId}/roles`, roleId)) === 1;
}

export async function disallowRole(moduleName: string, guild: Discord.Guild, roleId: string) {
  const guildId = guild.id;

  return (await redis.srem(`${moduleName}/${guildId}/roles`, roleId)) === 1;
}
