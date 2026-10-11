import React from 'react';
import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { InspectionInstitutionalMasthead } from '../../pages/inspecciones/InspectionInstitutionalMasthead';

it('inspection verification uses the shared SITREP mark without changing record identity or status', () => {
  const { container } = render(<InspectionInstitutionalMasthead inspectionNumber="I-QA-001" actNumber="QA-22" version={3} state="EN_CAMPO" />);
  expect(container.querySelector('[data-sitrep-mark]')).toHaveAttribute('src', '/favicon.svg');
  expect(container.querySelector('[data-sitrep-mark]')).toHaveAttribute('width', '32');
  expect(container.querySelector('.lucide-leaf')).toBeNull();
  expect(screen.getByText('I-QA-001')).toBeVisible();
  expect(screen.getByText('Acta QA-22 · versión 3')).toBeVisible();
  expect(screen.getByText('En campo')).toBeVisible();
  expect(screen.getByAltText('Gobierno de Mendoza')).toBeVisible();
});
