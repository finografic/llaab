import { Hono } from 'hono';
import type { AppEnv } from '../types/app.types.js';

/** Create a new Hono sub-router with the shared env. */
export function createRouter() {
  return new Hono<AppEnv>();
}

/** Create the root Hono app. */
export function createApp() {
  return new Hono<AppEnv>();
}
