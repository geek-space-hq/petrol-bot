import Discord from 'discord.js';

export type Feature<T> = (event: T, client: Discord.Client) => unknown;
export type MessageFeature = Feature<Discord.Message>;

class Bot {
  constructor(private client: Discord.Client) {}

  public onMessage(feature: MessageFeature) {
    this.client.on('message', message => {
      feature(message, this.client);
    });
  }
}

export type CommandCallback = (message: Discord.Message, client: Discord.Client, args: string[]) => unknown;
export function command(prefix: string, commandName: string, callback: CommandCallback): MessageFeature {
  return (message: Discord.Message, client: Discord.Client) => {
    const content = message.content;
    if (content.slice(0, prefix.length) !== prefix) {
      return;
    }

    const args = content
      .slice(prefix.length)
      .split(/[\s\n\t]+/)
      .filter(str => str !== '');

    if (args[0] !== commandName) {
      return;
    }

    callback(message, client, args.slice(1));
  };
}

export async function boot(token: string): Promise<Bot> {
  const client = new Discord.Client();
  const bot = new Bot(client);
  await client.login(token);
  return bot;
}
