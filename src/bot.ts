import Discord from 'discord.js';

export type Module = (client: Discord.Client) => void;

class Bot {
  constructor(private client: Discord.Client) {}

  public install(module: Module | Module[]) {
    const modules = [module].flat();
    modules.forEach(module => {
      module(this.client);
    });
  }
}

export type Feature<T> = (event: T, client: Discord.Client) => void;

export type MessageFeature = Feature<Discord.Message>;
export function onMessage(callback: MessageFeature): Module {
  return (client: Discord.Client) => {
    client.on('message', message => {
      callback(message, client);
    });
  };
}

export type CommandCallback = (message: Discord.Message, client: Discord.Client, args: string[]) => unknown;
export function command(prefix: string, commandName: string, callback: CommandCallback): Module {
  return onMessage((message: Discord.Message, client: Discord.Client) => {
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
  });
}

export async function boot(token: string): Promise<Bot> {
  const client = new Discord.Client();
  const bot = new Bot(client);
  await client.login(token);
  return bot;
}
