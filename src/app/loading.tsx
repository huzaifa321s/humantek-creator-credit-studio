import React from 'react';
import { StudioCardLayout } from '@/components/StudioCardLayout';
import { StudioPageLoader } from '@/components/ui/studio-page-loader';

export default function RootLoading() {
  return (
    <StudioCardLayout mode="standalone" backLabel="Back to Studio">
      <StudioPageLoader label="Loading studio..." variant="default" />
    </StudioCardLayout>
  );
}
