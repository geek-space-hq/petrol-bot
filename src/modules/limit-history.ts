import Discord from 'discord.js';

import { NextFunction } from '../bot';
import { redis } from '../lib/redis';
import { resolveOrNull } from '../lib/resolver';

async function getLimit(channelId: string): Promise<number> {
  const limit = await resolveOrNull(redis.get(`meslimit/${channelId}/limit`));
  return limit === null ? 0 : Number(limit);
}

async function getRoles(guildId: string): Promise<string[]> {
  const roles = await resolveOrNull(redis.smembers(`meslimit/${guildId}/roles`));
  if (roles === null) {
    return [];
  }
  return roles;
}

async function isAllowed(author: Discord.GuildMember, guild: Discord.Guild, allowedRoles: string[]): Promise<boolean> {
  if (author.id === guild.ownerID) {
    return true;
  }

  const roles = author.roles.cache;

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

const errors = {
  disallowed: 'あなたにこの操作は許可されていません。',
  unknown: '未知のコマンドです。',
  unspecified: 'ロールを指定してください。',
  notfound: 'ロールが見つかりませんでした。',
  already: 'その役職は既に許可されています。',
  notYet: 'その役職は許可されていません。',
} as const;

async function status(member: Discord.GuildMember, channelId: string) {
  const guild = member.guild;
  const roles = await getRoles(guild.id);

  const limit = await getLimit(channelId);
  const roleNames = roles
    .map(roleId => {
      const role = guild.roles.resolve(roleId);
      return role ? role.name : '';
    })
    .filter(role => role !== '');
  const allowedRoles = `この機能を操作可能な役職:\n${roleNames.join('\n')}`;
  return limit > 0 ? `meslimit: 有効, ${limit} messages\n${allowedRoles}` : `meslimit: 無効\n${allowedRoles}`;
}

async function allow(member: Discord.GuildMember, args: string[]) {
  const guild = member.guild;
  const guildId = guild.id;
  const roles = await getRoles(guildId);
  if (!(await isAllowed(member, guild, roles))) {
    return errors.disallowed;
  }

  const roleId = args[1];
  if (!roleId) {
    return errors.unspecified;
  }

  const role = guild.roles.resolve(roleId);
  if (!role) {
    return errors.notfound;
  }
  const roleName = role.name;

  if ((await redis.sadd(`meslimit/${guildId}/roles`, roleId)) !== 1) {
    return errors.already;
  }

  return `${roleName}を許可された役職に追加しました。`;
}

async function disallow(member: Discord.GuildMember, args: string[]) {
  const guild = member.guild;
  const guildId = guild.id;
  const roles = await getRoles(guildId);
  if (!(await isAllowed(member, guild, roles))) {
    return errors.disallowed;
  }

  const roleId = args[1];
  if (!roleId) {
    return errors.unspecified;
  }

  const role = guild.roles.resolve(roleId);
  const roleName = role ? role.name : 'Unknown';

  if ((await redis.srem(`meslimit/${guildId}/roles`, roleId)) !== 1) {
    return errors.already;
  }

  return `${roleName}を許可された役職から除外しました。`;
}

async function setLimit(member: Discord.GuildMember, channelId: string, limit: number) {
  if (limit <= 0) {
    return removeLimit(member, channelId);
  }
  const guild = member.guild;
  const roles = await getRoles(channelId);
  if (!(await isAllowed(member, guild, roles))) {
    return errors.disallowed;
  }

  await redis.set(`meslimit/${channelId}/limit`, limit);

  return `履歴の件数を${limit}件に制限しました。`;
}

async function removeLimit(member: Discord.GuildMember, channelId: string) {
  const guild = member.guild;
  const roles = await getRoles(channelId);
  if (!(await isAllowed(member, guild, roles))) {
    return errors.disallowed;
  }

  await redis.del(`meslimit/${channelId}/limit`);
  await redis.del(`meslimit/${channelId}/messages`);

  return '履歴の件数の制限を解除しました。';
}

export async function limitHistoryCommand(message: Discord.Message, _: Discord.Client, args: string[]) {
  const operation = args[0] || 'status';
  const channelId = message.channel.id;
  const guild = message.guild;

  if (!guild) {
    return;
  }

  const member = await guild.members.fetch(message.author.id);

  const result: string = await (async () => {
    switch (operation) {
      case 'status':
        return await status(member, channelId);

      case 'allow':
        return await allow(member, args);

      case 'disallow':
        return await disallow(member, args);

      case 'enable':
        return await setLimit(member, channelId, Number(args[1] || 10));

      case 'disable':
        return await removeLimit(member, channelId);

      default:
        return errors.unknown;
    }
  })();
  message.channel.send(result);
}

export async function limitHistory(message: Discord.Message, client: Discord.Client, next: NextFunction) {
  const channelId = message.channel.id;
  const limit = await getLimit(channelId);
  if (limit > 0) {
    const key = `meslimit/${channelId}/messages`;
    redis.rpush(key, message.id);
    if ((await redis.llen(key)) > limit) {
      const messageId = await redis.lpop(key);
      const resolved = await resolveOrNull(message.channel.messages.fetch(messageId));
      if (resolved) {
        await resolved.delete();
      }
    }
  }
  next();
}
