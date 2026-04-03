export class Token {
  constructor(
    public readonly accessToken: string,
    public readonly tokenType: string,
    public readonly expiresAt: Date,
  ) {}

  isExpired(bufferSeconds = 15): boolean {
    return new Date(Date.now() + bufferSeconds * 1000) >= this.expiresAt;
  }

  static fromArray(data: Record<string, unknown>): Token {
    let accessToken = String(data['access_token'] ?? '');
    if (accessToken.startsWith('Bearer ')) {
      accessToken = accessToken.slice(7);
    }

    const tokenType = String(data['token_type'] ?? 'Bearer');
    const expiresIn = typeof data['expires_in'] === 'number' ? data['expires_in'] : 3600;
    const expiresAt = new Date(Date.now() + expiresIn * 1000);

    return new Token(accessToken, tokenType, expiresAt);
  }

  toArray(): { access_token: string; token_type: string; expires_at: string } {
    return {
      access_token: this.accessToken,
      token_type: this.tokenType,
      expires_at: this.expiresAt.toISOString(),
    };
  }
}
