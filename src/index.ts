import { boot } from './bot';
import ExecCode from './modules/exec-code';
import LimitHistory from './modules/limit-history';
import Quote from './modules/quote';
import VimHelp from './modules/vim-help';

async function main() {
  console.log('GSBot v1.0.0');

  const token = process.env.PETROL_TOKEN;
  if (!token) {
    console.log('PETROL_TOKEN must be present');
    process.exit(1);
  }

  const bot = await boot(token);

  bot.install(ExecCode);
  bot.install(LimitHistory);
  bot.install(Quote);
  bot.install(VimHelp);

  console.log('Ready');
}

main();
