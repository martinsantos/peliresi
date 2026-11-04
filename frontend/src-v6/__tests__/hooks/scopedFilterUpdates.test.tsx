import React, { useLayoutEffect } from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { useScopedSearchParams } from '../../hooks/useScopedSearchParams';
let update: ReturnType<typeof useScopedSearchParams>[1];
let navigate: ReturnType<typeof useNavigate>;
function Workspace({ owner }: { owner: string }) {
  const [params, setParams] = useScopedSearchParams('rapid-test', ['search', 'estado', 'page'], owner);
  const currentNavigate = useNavigate();
  useLayoutEffect(() => { update = setParams; navigate = currentNavigate; }, [setParams, currentNavigate]);
  const location = useLocation();
  return <><output aria-label="Filters">{params.toString()}</output><output aria-label="Path">{location.pathname}</output></>;
}
function open(owner = 'a', path = '/list?search=old&page=4&keep=yes') {
  return render(<MemoryRouter initialEntries={[path]}><Workspace owner={owner}/></MemoryRouter>);
}
const change = (key: string, value: string) => (params: URLSearchParams) => { params.set(key, value); params.delete('page'); return params; };
beforeEach(() => sessionStorage.clear());
afterEach(cleanup);
it('composes three same-render changes and explicit removal, retaining unrelated parameters', () => {
  open();
  act(() => {
    update(change('search','new'));
    update(change('estado','PENDIENTE'));
    update(params => { params.delete('search'); return params; });
  });
  expect(screen.getByLabelText('Filters')).toHaveTextContent('keep=yes&estado=PENDIENTE');
  expect(screen.getByLabelText('Filters')).not.toHaveTextContent('search=');
  expect(screen.getByLabelText('Filters')).not.toHaveTextContent('page=');
});
it('does not reuse a pending search after navigation to another history entry', () => {
  open(); const old = update;
  act(() => update(change('search','new')));
  act(() => navigate('/list?search=linked&keep=yes'));
  act(() => old(change('estado','OBSOLETO')));
  expect(screen.getByLabelText('Filters')).toHaveTextContent('search=linked');
  expect(screen.getByLabelText('Filters')).not.toHaveTextContent('OBSOLETO');
  act(() => update(change('estado','ACTUAL')));
  expect(screen.getByLabelText('Filters')).toHaveTextContent('search=linked&keep=yes&estado=ACTUAL');
});
it('clears prior owner filters before another account can update and rejects the old callback', () => {
  const view = open(); const previous = update;
  view.rerender(<MemoryRouter initialEntries={['/list']}><Workspace owner="b"/></MemoryRouter>);
  expect(screen.getByLabelText('Filters')).toHaveTextContent(/^keep=yes$/);
  act(() => previous(change('search','other-account')));
  expect(screen.getByLabelText('Filters')).not.toHaveTextContent('other-account');
  act(() => update(change('estado','MIO')));
  expect(screen.getByLabelText('Filters')).toHaveTextContent('keep=yes&estado=MIO');
});
it('uses current history when going back instead of the last pending update', () => {
  open();
  act(() => navigate('/list?search=second'));
  act(() => update(change('estado','SECOND')));
  act(() => navigate(-1));
  act(() => update(change('estado','FIRST')));
  expect(screen.getByLabelText('Filters')).toHaveTextContent('search=old');
  expect(screen.getByLabelText('Filters')).toHaveTextContent('estado=FIRST');
  expect(screen.getByLabelText('Filters')).not.toHaveTextContent('SECOND');
});
