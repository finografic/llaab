import { readdir, readFile } from 'fs/promises';

export async function readMarkdownFiles(dirPath: string): Promise<string[]> {
  const entries = await readdir(dirPath);
  const markdownFiles = entries.filter((entry) => entry.endsWith('.md'));
  return Promise.all(markdownFiles.map((file) => readFile(`${dirPath}/${file}`, 'utf-8')));
}
