import 'reflect-metadata';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { Express } from 'express';
import { createApp } from '../src/main';

// Vercel's Node.js runtime invokes this with real (req, res) objects, not
// AWS Lambda's (event, context) shape — an Express app instance is already
// a valid (req, res) handler on its own, nothing needs to adapt it.
//
// Vercel keeps warm function instances alive between invocations, so cache
// the built app across calls instead of rebuilding the whole DI graph and
// DB connection pool on every request.
let expressAppPromise: Promise<Express> | null = null;

async function buildExpressApp(): Promise<Express> {
  const app = await createApp();
  await app.init();
  return app.getHttpAdapter().getInstance();
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!expressAppPromise) {
    expressAppPromise = buildExpressApp();
  }
  const expressApp = await expressAppPromise;
  expressApp(req, res);
}
