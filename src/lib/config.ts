import { promises as fs } from 'fs';
import { resolve } from 'path';

type Item = string | number | Config;

type Config = {
  [key: string]: Item | Item[];
};

let cached: Config | null = null;

export async function getConfig(...keys: (string | number)[]) {
  if (!cached) {
    const config = await fs.readFile(resolve(process.cwd(), 'config/config.json'));
    const parsed: Config = JSON.parse(config.toString('utf-8'));
    cached = parsed;
  }

  return getSubItem(cached, ...keys);
}

export function getSubItem(item: Item, ...keys: (string | number)[]) {
  return keys.reduce<Item | Item[] | null>((acc, key) => {
    if (acc === null || typeof acc !== 'object') {
      return null;
    }

    if (typeof key === 'number') {
      if (Array.isArray(acc) && acc.length > key) {
        return acc[key];
      } else {
        return null;
      }
    } else {
      if (!Array.isArray(acc) && key in acc) {
        return acc[key];
      } else {
        return null;
      }
    }
  }, item);
}
