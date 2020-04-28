import { readFile, writeFile } from 'fs';

export async function writeFileAsync(filename: string, data: string) {
  await new Promise((resolve, reject) => {
    writeFile(filename, data, err => {
      if (err) {
        reject(err);
        return;
      }

      resolve();
    });
  });
}

export async function readFileAsync(filename: string) {
  return await new Promise<string>((resolve, reject) => {
    readFile(filename, (err, data) => {
      if (err) {
        reject(err);
        return;
      }

      resolve(data.toString('utf-8'));
    });
  });
}
