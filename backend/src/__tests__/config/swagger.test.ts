import { describe, expect, it } from 'vitest';
import { swaggerSpec } from '../../config/swagger';

describe('Swagger configuration runtime compatibility', () => {
  it('loads swagger-jsdoc and produces an OpenAPI document', () => {
    expect(swaggerSpec.openapi).toBe('3.0.0');
    expect(swaggerSpec.info?.title).toContain('SITREP');
  });
});
