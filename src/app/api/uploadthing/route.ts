import type { NextRequest } from 'next/server';
import { createRouteHandler } from 'uploadthing/next';
import { ourFileRouter } from '@/lib/uploadthing/router';
import { getUploadThingToken } from '@/lib/uploadthing/resolve-token';

let handlers: ReturnType<typeof createRouteHandler> | null = null;

function getHandlers() {
  handlers ??= createRouteHandler({
    router: ourFileRouter,
    config: { token: getUploadThingToken() },
  });
  return handlers;
}

export const GET = (req: NextRequest) => getHandlers().GET(req);
export const POST = (req: NextRequest) => getHandlers().POST(req);
