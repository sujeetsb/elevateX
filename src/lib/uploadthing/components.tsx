'use client';

import { generateUploadButton } from '@uploadthing/react';
import type { OurFileRouter } from '@/lib/uploadthing/router';

export const ResumeUploadButton = generateUploadButton<OurFileRouter>();
