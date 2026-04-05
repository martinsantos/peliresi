import { describe, it, expect } from 'vitest';
import { parsePagination } from '../../utils/pagination';

describe('parsePagination', () => {
  it('returns defaults when no params provided', () => {
    const result = parsePagination({});
    expect(result).toEqual({ skip: 0, take: 20, page: 1, limit: 20 });
  });

  it('parses valid page and limit', () => {
    const result = parsePagination({ page: 3, limit: 10 });
    expect(result).toEqual({ skip: 20, take: 10, page: 3, limit: 10 });
  });

  it('parses string values (from query params)', () => {
    const result = parsePagination({ page: '2', limit: '50' });
    expect(result).toEqual({ skip: 50, take: 50, page: 2, limit: 50 });
  });

  it('clamps negative page to 1', () => {
    const result = parsePagination({ page: -5, limit: 10 });
    expect(result.page).toBe(1);
    expect(result.skip).toBe(0);
  });

  it('clamps zero page to 1', () => {
    const result = parsePagination({ page: 0, limit: 10 });
    expect(result.page).toBe(1);
    expect(result.skip).toBe(0);
  });

  it('clamps limit to maxLimit', () => {
    const result = parsePagination({ page: 1, limit: 500 });
    expect(result.limit).toBe(100);
    expect(result.take).toBe(100);
  });

  it('clamps negative limit to 1', () => {
    const result = parsePagination({ page: 1, limit: -10 });
    expect(result.limit).toBe(1);
    expect(result.take).toBe(1);
  });

  it('uses custom defaults', () => {
    const result = parsePagination({}, { page: 1, limit: 50, maxLimit: 200 });
    expect(result).toEqual({ skip: 0, take: 50, page: 1, limit: 50 });
  });

  it('respects custom maxLimit', () => {
    const result = parsePagination({ limit: 300 }, { maxLimit: 200 });
    expect(result.limit).toBe(200);
    expect(result.take).toBe(200);
  });

  it('handles NaN page input — falls back to default', () => {
    const result = parsePagination({ page: 'abc', limit: 10 });
    expect(result.page).toBe(1);
    expect(result.skip).toBe(0);
  });

  it('handles NaN limit input — falls back to default', () => {
    const result = parsePagination({ page: 1, limit: 'xyz' });
    expect(result.limit).toBe(20);
    expect(result.take).toBe(20);
  });

  it('calculates skip correctly for various pages', () => {
    expect(parsePagination({ page: 1, limit: 25 }).skip).toBe(0);
    expect(parsePagination({ page: 2, limit: 25 }).skip).toBe(25);
    expect(parsePagination({ page: 5, limit: 25 }).skip).toBe(100);
  });
});
