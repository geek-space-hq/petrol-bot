import { spawn } from 'child_process';

export async function spawnChild(command: string, args: string[] = [], stdin = ''): Promise<[number, Buffer]> {
  return await new Promise<[number, Buffer]>((resolve, reject) => {
    const process = spawn(command, args);
    let stdout = Buffer.alloc(0);

    process.on('exit', code => {
      resolve([code !== null ? code : -1, stdout]);
    });

    process.stdout.on('error', err => {
      reject(err);
    });

    process.stdout.on('data', chunk => {
      if (typeof chunk === 'string') {
        stdout = Buffer.concat([stdout, Buffer.from(chunk)]);
      } else if (chunk instanceof Buffer) {
        stdout = Buffer.concat([stdout, chunk]);
      }
    });

    process.stderr.on('error', err => {
      reject(err);
    });

    process.stderr.on('data', chunk => {
      if (typeof chunk === 'string') {
        stdout = Buffer.concat([stdout, Buffer.from(chunk)]);
      } else if (chunk instanceof Buffer) {
        stdout = Buffer.concat([stdout, chunk]);
      }
    });

    process.stdin.write(stdin, err => {
      if (err) {
        reject(err);
        return;
      }
    });
  });
}
