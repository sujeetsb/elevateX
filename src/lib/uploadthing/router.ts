import { createUploadthing, type FileRouter } from 'uploadthing/next';
import { UploadThingError } from 'uploadthing/server';
import { getSession } from '@/server/http/get-session';

const f = createUploadthing();

export const ourFileRouter = {
  resume: f({
    pdf: { maxFileSize: '8MB', maxFileCount: 1 },
    blob: { maxFileSize: '8MB', maxFileCount: 1 },
    text: { maxFileSize: '4MB', maxFileCount: 1 },
  })
    .middleware(async () => {
      const session = await getSession();
      if (!session?.user?.id) throw new UploadThingError('Unauthorized');
      return { userId: session.user.id };
    })
    .onUploadComplete(async () => ({})),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
