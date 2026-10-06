import { redirect } from 'next/navigation';

/**
 * The wizard has been unified into the root route `/` (`src/app/page.tsx`).
 * Any direct navigation to `/configure` is immediately redirected to `/`.
 */
export default function ConfigurePage() {
  redirect('/');
}
