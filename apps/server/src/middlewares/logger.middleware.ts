import type { MiddlewareHandler } from 'hono';

import { pc } from '../utils/picocolors.js';

const METHOD_COLORS: Record<string, (s: string) => string> = {
  GET: pc.cyan,
  POST: pc.green,
  PUT: pc.yellow,
  PATCH: pc.yellow,
  DELETE: pc.red,
};

function paintMethod(method: string): string {
  const paint = METHOD_COLORS[method] ?? pc.gray;
  return paint(method.padEnd(6));
}

function paintStatus(status: number): string {
  if (status < 300) return pc.green(String(status));
  if (status < 400) return pc.cyan(String(status));
  if (status < 500) return pc.yellow(String(status));
  return pc.red(String(status));
}

export const logger: MiddlewareHandler = async (c, next) => {
  const start = Date.now();
  await next();
  const ms = Date.now() - start;
  const method = paintMethod(c.req.method);
  const status = paintStatus(c.res.status);
  const path = pc.gray(c.req.path);
  const duration = pc.gray(`${ms}ms`);
  console.log(`${method} ${path} ${status} ${duration}`);
};
