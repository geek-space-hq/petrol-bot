import Discord from 'discord.js';

import { command, onMessage } from '../bot';
import { redis } from '../lib/redis';
import { resolveOrNull } from '../lib/resolver';
import { allowRole, disallowRole, getAllowedRoles, isAllowed } from '../lib/roles';

async function getLimit(channelId: string): Promise<number> {
  const limit = await resolveOrNull(redis.get(`${moduleName}/${channelId}/limit`));
  return limit === null ? 0 : Number(limit);
}

const errors = {
  disallowed: 'あなたにこの操作は許可されていません。',
  unknown: '未知のコマンドです。',
  unspecified: 'ロールを指定してください。',
  notfound: 'ロールが見つかりませんでした。',
  already: 'その役職は既に許可されています。',
  notYet: 'その役職は許可されていません。',
} as const;

const moduleName = 'meslimit';

async function status(member: Discord.GuildMember, channelId: string) {
  const guild = member.guild;
  const roles = await getAllowedRoles(moduleName, guild.id);

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
  if (!(await isAllowed(moduleName, member, guild))) {
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

  return (await allowRole(moduleName, guild, roleId)) ? `${roleName}を許可された役職に追加しました。` : errors.already;
}

async function disallow(member: Discord.GuildMember, args: string[]) {
  const guild = member.guild;
  if (!(await isAllowed(moduleName, member, guild))) {
    return errors.disallowed;
  }

  const roleId = args[1];
  if (!roleId) {
    return errors.unspecified;
  }

  const role = guild.roles.resolve(roleId);
  const roleName = role ? role.name : 'Unknown';

  return (await disallowRole(moduleName, guild, roleId))
    ? `${roleName}を許可された役職から除外しました。`
    : errors.notYet;
}

async function setLimit(member: Discord.GuildMember, channelId: string, limit: number) {
  if (limit <= 0) {
    return removeLimit(member, channelId);
  }
  const guild = member.guild;
  if (!(await isAllowed(moduleName, member, guild))) {
    return errors.disallowed;
  }

  await redis.set(`${moduleName}/${channelId}/limit`, limit);

  return `履歴の件数を${limit}件に制限しました。`;
}

async function removeLimit(member: Discord.GuildMember, channelId: string) {
  const guild = member.guild;
  if (!(await isAllowed(moduleName, member, guild))) {
    return errors.disallowed;
  }

  await redis.del(`${moduleName}/${channelId}/limit`);
  await redis.del(`${moduleName}/${channelId}/messages`);

  return '履歴の件数の制限を解除しました。';
}

export const limitHistoryCommand = command(
  'ps!',
  'meslimit',
  async (message: Discord.Message, _: Discord.Client, args: string[]) => {
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
  },
);

export const limitHistory = onMessage(async (message: Discord.Message, _client: Discord.Client) => {
  const channelId = message.channel.id;
  const limit = await getLimit(channelId);
  if (limit > 0) {
    const key = `${moduleName}/${channelId}/messages`;
    redis.rpush(key, message.id);
    if ((await redis.llen(key)) > limit) {
      const messageId = await redis.lpop(key);
      const resolved = await resolveOrNull(message.channel.messages.fetch(messageId));
      if (resolved) {
        await resolved.delete();
      }
    }
  }
});
