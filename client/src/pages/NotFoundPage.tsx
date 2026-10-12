import { FileQuestion } from 'lucide-react';
import { ButtonLink } from '@/components/ui/Button';

export function NotFoundPage() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-24 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-slate-100 text-slate-500">
        <FileQuestion className="size-6" aria-hidden="true" />
      </div>
      <h1 className="mt-4 text-lg font-semibold text-slate-900">Page not found</h1>
      <p className="mt-1 text-sm text-slate-600">The page you were looking for doesn't exist or has moved.</p>
      <ButtonLink to="/" variant="secondary" className="mt-6">
        Go to dashboard
      </ButtonLink>
    </div>
  );
}
