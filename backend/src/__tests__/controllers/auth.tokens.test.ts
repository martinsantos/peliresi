import jwt from 'jsonwebtoken';
import { generateTokens } from '../../controllers/auth.controller';

describe('generateTokens', () => {
  it('adds a unique JWT id so immediate sessions never collide', () => {
    const first = generateTokens('user-1');
    const second = generateTokens('user-1');
    const firstPayload = jwt.decode(first.refreshToken) as { jti?: string };
    const secondPayload = jwt.decode(second.refreshToken) as { jti?: string };

    expect(firstPayload.jti).toEqual(expect.any(String));
    expect(secondPayload.jti).toEqual(expect.any(String));
    expect(firstPayload.jti).not.toBe(secondPayload.jti);
    expect(first.refreshToken).not.toBe(second.refreshToken);
  });
});
