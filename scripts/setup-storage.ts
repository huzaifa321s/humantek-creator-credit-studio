import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  const { data: buckets } = await admin.storage.listBuckets();
  const exists = buckets?.some((b) => b.name === 'project-attachments');
  if (!exists) {
    const { data, error } = await admin.storage.createBucket('project-attachments', {
      public: false,
      fileSizeLimit: 52428800, // 50MB
      allowedMimeTypes: [
        'image/png', 'image/jpeg', 'image/webp', 'image/gif',
        'video/mp4', 'video/webm',
        'application/pdf', 'application/zip', 'application/x-zip-compressed',
        'application/vnd.adobe.photoshop', 'application/illustrator'
      ]
    });
    console.log('Created project-attachments bucket:', data, error);
  } else {
    console.log('project-attachments bucket already exists.');
  }
}

main().catch(console.error);
