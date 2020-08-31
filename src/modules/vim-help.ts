import Discord from 'discord.js';
import { onMessage } from '../bot';

const { VimHelp } = require('vimhelp');
const vimHelp = new VimHelp();
vimHelp.helplang = ['ja', 'en']; // if Japanese help is installed, use it

async function searchVimHelp(message: Discord.Message, client: Discord.Client) {
  if (!message.guild || !client.user || message.author.id === client.user.id) {
    return;
  }

  const content = message.content;
  if (!content.startsWith(':h ') && !content.startsWith(':help ')) {
    return;
  }

  try {
    const helpText = await vimHelp.search(
      content
        .split(' ')
        .slice(1)
        .join(' '),
    );
    const sliced = helpText.length > 1900 ? helpText.slice(0, 1900) + '...' : helpText;
    const sending = `\`\`\`\n${sliced}\n\`\`\``;
    await message.channel.send(sending);
  } catch (err) {
    await message.channel.send('予期しないエラーが発生しました。');
    throw err;
  }
}

export default onMessage(searchVimHelp);
