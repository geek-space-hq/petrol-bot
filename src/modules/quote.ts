import Discord from 'discord.js';

import { NextFunction } from '../bot';
import { dateTime } from '../lib/date-time';
import { resolveOrNull } from '../lib/resolver';

export async function quote(message: Discord.Message, client: Discord.Client, next: NextFunction) {
  if (!message.guild || !client.user || message.author.id === client.user.id) {
    next();
    return;
  }

  const pattern = /discordapp\.com\/channels\/([0-9]+)\/([0-9]+)\/([0-9]+)/;
  const matches = message.content.match(pattern);

  if (!matches) {
    next();
    return;
  }

  const channelId = matches[2];
  const messageId = matches[3];

  const channel = message.guild.channels.resolve(channelId);
  const quoted = await resolveOrNull(message.channel.messages.fetch(messageId));
  if (!channel || !quoted) {
    return;
  }

  const avatar = quoted.author.avatarURL() || undefined;
  const timestamp = dateTime(quoted.createdAt);
  const embed = new Discord.MessageEmbed()
    .setAuthor(quoted.author.username, avatar)
    .setDescription(quoted.content)
    .setFooter(`${message.guild.name}, #${channel.name} - ${timestamp}`);

  message.channel.send(embed);
}
