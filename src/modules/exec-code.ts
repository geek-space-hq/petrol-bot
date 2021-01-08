import Discord from 'discord.js';
import { promises as fs } from 'fs';
import { resolve } from 'path';

import { onMessage } from '../bot';
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

async function execCode(message: Discord.Message, client: Discord.Client) {
  if (!message.guild || !client.user || message.author.id === client.user.id) {
    return;
  }

  const content = message.content;
  if (content.slice(0, 6) !== 'ps!run') {
    return;
  }

  const pattern = /^```(.*)$\n((.|\n)+?)\n^```$/gm;
  const matches = [...content.matchAll(pattern)];
  const id = String(Math.floor(Math.random() * 1000));

  if (matches.length >= 1) {
    const languageName = matches[0][1].toLowerCase();
    const source = matches[0][2];
    const stdin = matches.length >= 2 ? matches[1][2] : '';

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

      await fs.writeFile(resolve(containerPath, 'box', filename), source);
      await fs.writeFile(resolve(containerPath, 'box', 'stdin'), stdin);
      let lastResult = '';
      for (const step of steps) {
        const begin = Date.now();
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
          '--stdin=stdin',
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
        const elapsed = Date.now() - begin;
        lastResult = `\`\`\`\n${sliced}\n\`\`\`\n経過時間: ${elapsed}ms`;
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
    message.channel.send('ソースコードか言語名が指定されていません。');
  }
}

export default onMessage(execCode);
