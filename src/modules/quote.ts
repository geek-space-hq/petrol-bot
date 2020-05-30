import Discord from 'discord.js';

import { NextFunction } from '../bot';
import { dateTime } from '../lib/date-time';
import { resolveOrNull } from '../lib/resolver';

export async function quote(message: Discord.Message, client: Discord.Client, next: NextFunction) {
  if (!message.guild || !client.user || message.author.id === client.user.id) {
    next();
    return;
  }

  const pattern = /discord(app)?\.com\/channels\/([0-9]+)\/([0-9]+)\/([0-9]+)/g;
  const matches = message.content.matchAll(pattern);

  for (const match of matches) {
    const channelId = match[3];
    const messageId = match[4];

    const channel = message.guild.channels.resolve(channelId) as Discord.TextChannel;
    if (!channel || channel.type !== 'text') {
      return;
    }
    const quoted = await resolveOrNull(channel.messages.fetch(messageId));
    if (!quoted) {
      return;
    }

    const avatar = quoted.author.avatarURL() || undefined;
    const timestamp = dateTime(quoted.createdAt);
    const embed = new Discord.MessageEmbed()
      .setAuthor(quoted.author.username, avatar)
      .setDescription(quoted.content)
      .setFooter(`${message.guild.name}, #${channel.name} - ${timestamp}`);

    const attachment = quoted.attachments.first();
    if (attachment) {
      embed.setImage(attachment.url);
    }

    await message.channel.send(embed);
  }

  next();
}
