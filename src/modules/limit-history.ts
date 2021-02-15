import Discord from 'discord.js';
import { get } from 'https';

import { command, onAnyEvent, onMessage } from '../bot';
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
  roleUnspecified: 'ロールを指定してください。',
  channelUnspecified: 'チャンネルを指定してください。',
  roleNotfound: 'ロールが見つかりませんでした。',
  channelNotfound: 'チャンネルが見つかりませんでした。',
  logNotRegistered: 'ログチャンネルは登録されていません。',
  already: 'その役職は既に許可されています。',
  notYet: 'その役職は許可されていません。',
  unexpected: '予期せぬエラーです。',
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
    return errors.roleUnspecified;
  }

  const role = guild.roles.resolve(roleId);
  if (!role) {
    return errors.roleNotfound;
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
    return errors.roleUnspecified;
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
  await removeLog(member, channelId);

  return '履歴の件数の制限を解除しました。';
}

async function resolveLog(guild: Discord.Guild, channelId: string): Promise<Discord.TextChannel | null> {
  const logId = await redis.get(`${moduleName}/${channelId}/log_at`);
  if (!logId) {
    return null;
  }
  return guild.channels.resolve(logId) as Discord.TextChannel | null;
}

async function fetchLogWebhook(guild: Discord.Guild, channelId: string): Promise<Discord.Webhook | null> {
  const logChannel = await resolveLog(guild, channelId);
  if (!logChannel) {
    return null;
  }
  const webhooks = await logChannel.fetchWebhooks();
  const webhookId = await redis.get(`${moduleName}/${logChannel.id}/webhook`);
  if (!webhookId) {
    return null;
  }
  return webhooks.get(webhookId) || null;
}

async function setLog(member: Discord.GuildMember, channelId: string, logId: string) {
  const guild = member.guild;
  if (!(await isAllowed(moduleName, member, guild))) {
    return errors.disallowed;
  }

  await removeLog(member, channelId);

  const logChannel = guild.channels.resolve(logId) as Discord.TextChannel | null;

  if (!logChannel) {
    return errors.channelNotfound;
  }

  await redis.set(`${moduleName}/${channelId}/log_at`, logId);

  const webhook = await (async () => {
    const fetchedWebhook = await fetchLogWebhook(guild, channelId);
    if (fetchedWebhook) {
      return fetchedWebhook;
    }

    const webhook = await logChannel.createWebhook('meslimit log');
    await redis.set(`${moduleName}/${logChannel.id}/webhook`, webhook.id);
    return webhook;
  })();

  await webhook.send('Meslimit によって削除されたメッセージのログを開始しました。', {
    username: 'Petrol Bot Meslimit',
  });

  return `#${logChannel.name}をログチャンネルに設定しました。`;
}

async function removeLog(member: Discord.GuildMember, channelId: string) {
  const guild = member.guild;
  if (!(await isAllowed(moduleName, member, guild))) {
    return errors.disallowed;
  }

  const webhook = await fetchLogWebhook(guild, channelId);

  if (!webhook) {
    return errors.logNotRegistered;
  }

  await webhook.send('Meslimit によるログを終了しました。', {
    username: 'Petrol Bot Meslimit',
  });

  await redis.del(`${moduleName}/${channelId}/log_at`);

  return 'ログチャンネルを解除しました。';
}

async function limitHistoryCommand(message: Discord.Message, _: Discord.Client, args: string[]) {
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

      case 'enable-log':
        return await setLog(member, channelId, args[1]);

      case 'disable-log':
        return await removeLog(member, channelId);

      default:
        return errors.unknown;
    }
  })();
  message.channel.send(result);
}

async function downloadFile(url: string) {
  return await new Promise<Buffer>(resolve => {
    get(url, res => {
      let buf = Buffer.alloc(0);

      res.on('data', data => {
        buf = Buffer.concat([buf, data]);
      });

      res.on('end', () => resolve(buf));
    });
  });
}

async function limitHistory(message: Discord.Message, _client: Discord.Client) {
  const channelId = message.channel.id;
  const limit = await getLimit(channelId);
  if (limit > 0) {
    const key = `${moduleName}/${channelId}/messages`;
    redis.rpush(key, message.id);
    if ((await redis.llen(key)) > limit) {
      const messageId = await redis.lpop(key);
      const resolved = await resolveOrNull(message.channel.messages.fetch(messageId));
      if (resolved) {
        const webhook = await fetchLogWebhook(message.guild as Discord.Guild, channelId);
        if (webhook) {
          const attachments = await Promise.all(
            resolved.attachments.map(async attachment => ({
              attachment: await downloadFile(attachment.url),
              name: attachment.name,
            })),
          );
          const allowedMentions = resolved.author.bot
            ? {
                allowedMentions: {
                  parse: [],
                },
              }
            : {};
          const message = await webhook.send(resolved.content, {
            username: resolved.author.username,
            avatarURL: resolved.author.displayAvatarURL(),
            embeds: resolved.embeds,
            files: attachments,
            ...allowedMentions,
          });
          await redis.set(`${moduleName}/${message.id}/author`, resolved.author.id);
        }
        await resolved.delete();
      }
    }
  }
}

async function removeLogOnReaction(event: any, client: Discord.Client) {
  if (event.t !== 'MESSAGE_REACTION_ADD') {
    return;
  }

  const authorId = await redis.get(`${moduleName}/${event.d.message_id}/author`);
  if (event.d.user_id !== authorId) {
    return;
  }

  const guild = client.guilds.resolve(event.d.guild_id);
  if (guild === null) {
    return;
  }

  const channel = guild.channels.resolve(event.d.channel_id) as Discord.TextChannel | null;
  if (channel === null) {
    return;
  }

  const message = await channel.messages.fetch(event.d.message_id);
  if (message === null) {
    return;
  }

  await message.delete();
}

export default [
  command('ps!', 'meslimit', limitHistoryCommand),
  onMessage(limitHistory),
  onAnyEvent(removeLogOnReaction),
];
