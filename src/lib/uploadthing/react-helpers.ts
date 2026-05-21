'use client';

import { generateReactHelpers } from '@uploadthing/react';
import type { OurFileRouter } from '@/lib/uploadthing/router';

export const { useUploadThing } = generateReactHelpers<OurFileRouter>();
