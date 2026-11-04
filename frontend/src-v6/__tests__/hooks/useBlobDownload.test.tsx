import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useBlobDownload } from '../../hooks/useBlobDownload';

function Download({ blob }: { blob: Blob }) {
  const ref = useBlobDownload(blob);
  return <a ref={ref} download="copy.txt">Descargar copia</a>;
}
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
it('keeps a usable link across rerenders, changes it for a new blob and releases each URL', () => {
  const create = vi.spyOn(URL, 'createObjectURL').mockReturnValueOnce('blob:first').mockReturnValueOnce('blob:second');
  const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  const first = new Blob(['first']);
  const view = render(<Download blob={first} />);
  expect(screen.getByRole('link')).toHaveAttribute('href', 'blob:first');
  expect(screen.getByRole('link')).toHaveAttribute('download', 'copy.txt');
  view.rerender(<Download blob={first} />);
  expect(create).toHaveBeenCalledTimes(1); expect(revoke).not.toHaveBeenCalled();
  view.rerender(<Download blob={new Blob(['second'])} />);
  expect(screen.getByRole('link')).toHaveAttribute('href', 'blob:second');
  expect(revoke).toHaveBeenCalledExactlyOnceWith('blob:first');
  view.unmount();
  expect(revoke.mock.calls).toEqual([['blob:first'], ['blob:second']]);
});
