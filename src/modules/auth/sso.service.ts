 
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
 
const SSO_COOKIE_NAME = 'boldmind_sso';
 
@Injectable()
export class SsoService {
  private readonly isProd: boolean;
  private readonly cookieDomain: string;
 
  constructor(private readonly config: ConfigService) {
    this.isProd = this.config.get('NODE_ENV') === 'production';
    this.cookieDomain = this.isProd ? '.boldmind.ng' : 'localhost';
  }
 
  setSsoCookie(res: Response, accessToken: string): void {
    res.cookie(SSO_COOKIE_NAME, accessToken, {
      httpOnly: true,
      secure: this.isProd,
      sameSite: this.isProd ? 'none' : 'lax',
      domain: this.cookieDomain,
      maxAge: 15 * 60 * 1000, // 15 minutes (matches JWT expiry)
      path: '/',
    });
  }
 
  clearSsoCookie(res: Response): void {
    res.clearCookie(SSO_COOKIE_NAME, {
      domain: this.cookieDomain,
      path: '/',
    });
  }
}