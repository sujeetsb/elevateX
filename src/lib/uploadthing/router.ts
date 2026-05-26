import { createUploadthing, type FileRouter } from 'uploadthing/next';
import { UploadThingError } from 'uploadthing/server';
import { getSession } from '@/server/http/get-session';
import { validateResumeUpload } from '@/lib/resume/validate-upload';

const f = createUploadthing();

export const ourFileRouter = {
  resume: f({
    pdf: { maxFileSize: '8MB', maxFileCount: 1 },
    blob: { maxFileSize: '8MB', maxFileCount: 1 },
  })
    .middleware(async ({ files }) => {
      const session = await getSession();
      if (!session?.user?.id) throw new UploadThingError('Unauthorized');

      const file = files[0];
      if (!file) throw new UploadThingError('No file provided');

      const validation = validateResumeUpload(file.name, file.type);
      if (!validation.ok) {
        throw new UploadThingError(validation.message);
      }

      return { userId: session.user.id };
    })
    .onUploadComplete(async () => ({})),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
