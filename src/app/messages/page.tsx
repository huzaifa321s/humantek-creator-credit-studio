'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function MessagesPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/management');
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground text-sm font-medium">
      Routing to Agency Management Console...
    </div>
  );
}
