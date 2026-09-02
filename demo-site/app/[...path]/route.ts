import { env } from 'cloudflare:workers';
import { handle, type DemoEnvironment } from '../../server/handler';
export const GET = (request: Request) =>
  handle(request, env as DemoEnvironment);
export const POST = GET;
