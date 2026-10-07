import { redirect } from 'next/navigation';

/**
 * The wizard has been relocated to `/new-project`.
 * Any direct navigation to `/configure` is immediately redirected to `/new-project`.
 */
export default function ConfigurePage() {
  redirect('/new-project');
}
