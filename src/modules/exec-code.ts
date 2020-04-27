import Discord from 'discord.js';
import { resolve } from 'path';

import { NextFunction } from '../bot';
import { writeFileAsync } from '../lib/async-fs';
import { spawnChild } from '../lib/async-process';
import { getConfig, getSubItem } from '../lib/config';

type Languages = {
  [key: string]: {
    source: string;
    steps: string[];
  };
};
let languages: Languages | null = null;

function validateStringArray(arr: unknown[]): arr is string[] {
  for (const item in arr) {
    if (typeof item !== 'string') {
      return false;
    }
  }
  return true;
}

async function getLanguages(): Promise<Languages> {
  const loaded = await getConfig('exec-code', 'languages');

  if (languages !== null) {
    return languages;
  }

  if (!Array.isArray(loaded)) {
    return languages || {};
  }

  languages = {};

  for (const language of loaded) {
    const names = getSubItem(language, 'names');
    const source = getSubItem(language, 'source-name');
    const steps = getSubItem(language, 'steps');

    if (
      typeof source !== 'string' ||
      !Array.isArray(names) ||
      !Array.isArray(steps) ||
      !validateStringArray(names) ||
      !validateStringArray(steps)
    ) {
      continue;
    }

    for (const name of names) {
      languages[name.toLowerCase()] = { source, steps };
    }
  }

  return languages;
}

export async function execCode(message: Discord.Message, client: Discord.Client, next: NextFunction) {
  if (!message.guild || !client.user || message.author.id === client.user.id) {
    next();
    return;
  }

  const content = message.content;
  if (content.slice(0, 6) !== 'ps!run') {
    next();
    return;
  }

  const pattern = /^```(.*)$\n((.|\n)+)\n^```$/m;
  const match = content.match(pattern);
  const id = String(Math.floor(Math.random() * 1000));

  if (match) {
    const languageName = match[1].toLowerCase();
    const source = match[2];

    const languages = await getLanguages();
    const language = languages[languageName];

    if (!language) {
      message.channel.send('未対応の言語です。');
      return;
    }

    const filename = language.source;
    const steps = language.steps;

    try {
      const containerPath = await (async () => {
        const result = await spawnChild('isolate', ['-b', id, '--init']);
        return result[1].toString('utf-8').trim();
      })();

      await writeFileAsync(resolve(containerPath, 'box', filename), source);
      let lastResult = '';
      for (const step of steps) {
        const result = await spawnChild('isolate', [
          '--dir=dev=',
          '--dir=proc=',
          '--dir=tmp=',
          '-w',
          '1',
          '-m',
          '262144',
          '-f',
          '16384',
          '-b',
          id,
          '--stderr-to-stdout',
          '--processes=4',
          '--env=PATH=/usr/bin',
          '-s',
          '--run',
          ...step.split(' '),
        ]);
        const code = result[0];
        const stdout = result[1].toString('utf-8');
        const sliced = stdout.length > 1900 ? stdout.slice(0, 1900) + '...' : stdout;
        lastResult = `\`\`\`\n${sliced}\n\`\`\``;
        if (code !== 0) {
          lastResult += `\n0以外のコードで終了しました: ${code}`;
          break;
        }
      }
      await message.channel.send(lastResult);
    } catch (err) {
      await message.channel.send('予期しないエラーが発生しました。');
      throw err;
    } finally {
      spawnChild('isolate', ['-b', id, '--cleanup']);
    }
  } else {
    message.channel.send('ソースコードが貼られていないか、または言語名が指定されていません。');
  }

  next();
}
