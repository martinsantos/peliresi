import { nativeKeyboardShown } from './native-window.ts';

/** Back is allowed exactly once, and only when the OS reports an open keyboard. */
export async function dismissObservedKeyboard(
  read: () => Promise<string>, back: () => Promise<void>, waitHidden: () => Promise<void>,
) {
  const before = await read();
  if (!nativeKeyboardShown(before)) return { dismissed: false, before, after: before };
  await back();
  await waitHidden();
  const after = await read();
  if (nativeKeyboardShown(after)) throw new Error('Android keyboard remained open after Back');
  return { dismissed: true, before, after };
}
