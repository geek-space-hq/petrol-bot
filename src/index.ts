import { boot } from './bot';

async function main() {
  console.log('GSBot v1.0.0');

  const token = process.env.PETROL_TOKEN;
  if (!token) {
    console.log('PETROL_TOKEN must be present');
    process.exit(1);
  }

  const bot = await boot(token);

  bot.onMessage((message, _, next) => {
    if (message.content.toLowerCase().includes('ping')) {
      message.channel.send('pong!');
    } else {
      next();
    }
  });

  console.log('Ready');
}

main();
