import type { ReactNode } from 'react';
import { MendozaBrand } from '../../../components/MendozaBrand';
import { SitrepMark, SitrepWordmark } from '../../../components/SitrepMark';

/** The public form owns its title and width on both web and app. */
export function RegistrationFrame({ title, children }: { title: string; children: ReactNode }) {
  return <div className="min-h-dvh bg-neutral-50 text-neutral-900">
    <header className="border-b border-neutral-200 bg-white px-4 py-3 sm:px-8">
      <div className="mx-auto flex max-w-[960px] items-center justify-between gap-4">
        <MendozaBrand className="!h-9 !w-auto sm:!h-11" />
        <div className="flex shrink-0 items-center gap-2"><SitrepMark size={32} /><SitrepWordmark className="text-lg font-bold sm:text-xl" /></div>
      </div>
    </header>
    <main className="mx-auto w-full max-w-[1024px] space-y-4 px-4 py-6 sm:space-y-6 sm:px-8 sm:py-8">
      <h1 className="text-xl font-semibold leading-tight sm:text-2xl">{title}</h1>
      {children}
    </main>
  </div>;
}
