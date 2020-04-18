import Discord from 'discord.js';

export type NextFunction = () => unknown;
export type Feature<T> = (event: T, client: Discord.Client, next: NextFunction) => unknown;
export type MessageFeature = Feature<Discord.Message>;
type Features = {
  message: MessageFeature[];
};

class Bot {
  private features: Features = {
    message: [],
  };

  public onMessage(feature: MessageFeature) {
    this.features.message.push(feature);
  }

  constructor(client: Discord.Client) {
    const next = <T>(index: number, features: Feature<T>[], event: T) => () => {
      const feature = features[index];
      if (!feature) {
        return;
      }
      feature(event, client, next(index + 1, features, event));
    };

    client.on('message', message => {
      next(0, this.features.message, message)();
    });
  }
}

export type CommandCallback = (message: Discord.Message, client: Discord.Client, args: string[]) => unknown;
export function command(prefix: string, commandName: string, callback: CommandCallback): MessageFeature {
  return (message: Discord.Message, client: Discord.Client, next: NextFunction) => {
    const content = message.content;
    if (content.slice(0, prefix.length) !== prefix) {
      next();
      return;
    }

    const args = content
      .slice(prefix.length)
      .split(/[\s\n\t]+/)
      .filter(str => str !== '');

    if (args[0] !== commandName) {
      next();
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
