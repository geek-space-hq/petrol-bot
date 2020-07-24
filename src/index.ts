import { boot, command } from './bot';
import { execCode } from './modules/exec-code';
import { limitHistory, limitHistoryCommand } from './modules/limit-history';
import { quote } from './modules/quote';
import { searchVimHelp } from './modules/vim-help';

async function main() {
  console.log('GSBot v1.0.0');

  const token = process.env.PETROL_TOKEN;
  if (!token) {
    console.log('PETROL_TOKEN must be present');
    process.exit(1);
  }

  const bot = await boot(token);

  bot.onMessage(execCode);
  bot.onMessage(limitHistory);
  bot.onMessage(command('ps!', 'meslimit', limitHistoryCommand));
  bot.onMessage(quote);
  bot.onMessage(searchVimHelp);

  console.log('Ready');
}

main();
