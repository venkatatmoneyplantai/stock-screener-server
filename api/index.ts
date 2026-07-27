import 'reflect-metadata';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import serverless from 'serverless-http';
import { createApp } from '../src/main';

// Vercel keeps warm function instances alive between invocations, so cache
// the Nest app (and the serverless-http wrapper around it) across calls
// instead of rebuilding the whole DI graph and DB connection every request.
let handlerPromise: ReturnType<typeof buildHandler> | null = null;

async function buildHandler() {
  const app = await createApp();
  await app.init();
  return serverless(app.getHttpAdapter().getInstance());
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!handlerPromise) {
    handlerPromise = buildHandler();
  }
  const serverlessHandler = await handlerPromise;
  return serverlessHandler(req, res);
}
