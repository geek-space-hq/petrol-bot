import Discord from 'discord.js';

import { dateTime } from '../lib/date-time';
import { resolveOrNull } from '../lib/resolver';
import { onMessage } from '../bot';

async function quote(message: Discord.Message, client: Discord.Client) {
  if (!message.guild || !client.user || message.author.id === client.user.id || message.author.bot) {
    return;
  }

  const pattern = /discord(app)?\.com\/channels\/[0-9]+\/(?<channelId>[0-9]+)\/(?<messageId>[0-9]+)/g;
  const matches = message.content.matchAll(pattern);

  for (const match of matches) {
    if (!match.groups) {
      continue;
    }

    const { channelId, messageId } = match.groups;

    const channel = message.guild.channels.resolve(channelId) as Discord.TextChannel;
    if (!channel || channel.type !== 'text') {
      continue;
    }
    const quoted = await resolveOrNull(channel.messages.fetch(messageId));
    if (!quoted) {
      continue;
    }

    const avatar = quoted.author.avatarURL() || undefined;
    const timestamp = dateTime(quoted.createdAt);
    const embed = new Discord.MessageEmbed()
      .setAuthor(quoted.author.username, avatar)
      .setDescription(quoted.content)
      .setFooter(`${message.guild.name}, #${channel.name} - ${timestamp}`);

    const attachment = quoted.attachments.first();
    if (attachment) {
      if (attachment.spoiler) {
        embed.attachFiles([attachment]);
      } else {
        embed.setImage(attachment.url);
      }
    }

    const embeds = [embed, ...(quoted.embeds.length > 0 ? ['Embeds:', ...quoted.embeds] : [])];

    for (const embed of embeds) {
      await message.channel.send(embed);
    }
  }
}

export default onMessage(quote);
