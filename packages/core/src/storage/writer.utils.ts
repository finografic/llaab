import { mkdir, writeFile } from 'fs/promises';
import { dirname } from 'path';

export async function writeTextFile(filePath: string, content: string): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, content, 'utf-8');
}
