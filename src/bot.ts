import Discord from 'discord.js';

type Feature<T> = (event: T, client: Discord.Client, next: () => unknown) => unknown;
type MessageFeature = Feature<Discord.Message>;
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

export async function boot(token: string): Promise<Bot> {
  const client = new Discord.Client();
  const bot = new Bot(client);
  await client.login(token);
  return bot;
}
