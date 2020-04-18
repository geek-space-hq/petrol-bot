import { boot, command } from './bot';
import { quote } from './modules';
import { limitHistory, limitHistoryCommand } from './modules/limit-history';

async function main() {
  console.log('GSBot v1.0.0');

  const token = process.env.PETROL_TOKEN;
  if (!token) {
    console.log('PETROL_TOKEN must be present');
    process.exit(1);
  }

  const bot = await boot(token);

  bot.onMessage(command('ps!', 'meslimit', limitHistoryCommand));
  bot.onMessage(limitHistory);
  bot.onMessage(quote);

  console.log('Ready');
}

main();
