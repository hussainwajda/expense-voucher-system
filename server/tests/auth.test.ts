import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { EMAILS, PASSWORD, app, loginAs, resetDatabase } from './helpers.js';

describe('authentication', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it('logs in with valid credentials and sets an httpOnly session cookie', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: EMAILS.employee, password: PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ email: EMAILS.employee, role: 'EMPLOYEE', fullName: 'Asha Employee' });
    expect(res.body.user.passwordHash).toBeUndefined();
    expect(res.body.token).toEqual(expect.any(String));
    const cookie = res.headers['set-cookie']?.[0] ?? '';
    expect(cookie).toMatch(/^evms_session=/);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
  });

  it('treats email case-insensitively', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: EMAILS.employee.toUpperCase(), password: PASSWORD });
    expect(res.status).toBe(200);
  });

  it('rejects a wrong password and an unknown email with the same message', async () => {
    const wrong = await request(app).post('/api/auth/login').send({ email: EMAILS.employee, password: 'nope' });
    const unknown = await request(app).post('/api/auth/login').send({ email: 'ghost@test.example', password: PASSWORD });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body.error.code).toBe('INVALID_CREDENTIALS');
    expect(unknown.body.error.message).toBe(wrong.body.error.message);
  });

  it('validates the login payload', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'not-an-email' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details).toHaveProperty('email');
    expect(res.body.error.details).toHaveProperty('password');
  });

  it('blocks protected routes without a session', async () => {
    expect((await request(app).get('/api/auth/me')).status).toBe(401);
    expect((await request(app).get('/api/vouchers')).status).toBe(401);
    expect((await request(app).get('/api/dashboard')).status).toBe(401);
  });

  it('accepts the session cookie and the Authorization header', async () => {
    const agent = await loginAs(EMAILS.director);
    const me = await agent.get('/api/auth/me');
    expect(me.status).toBe(200);
    expect(me.body.user.role).toBe('DIRECTOR');

    const login = await request(app).post('/api/auth/login').send({ email: EMAILS.accounts, password: PASSWORD });
    const viaHeader = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${login.body.token}`);
    expect(viaHeader.status).toBe(200);
    expect(viaHeader.body.user.role).toBe('ACCOUNTS');
  });

  it('rejects a tampered token', async () => {
    const login = await request(app).post('/api/auth/login').send({ email: EMAILS.employee, password: PASSWORD });
    const [header, payload, signature] = login.body.token.split('.');
    const forged = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(payload, 'base64url').toString()), role: 'DIRECTOR', sub: '3' })).toString('base64url');
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${header}.${forged}.${signature}`);
    expect(res.status).toBe(401);
  });

  it('logs out by clearing the cookie', async () => {
    const agent = await loginAs(EMAILS.employee);
    expect((await agent.post('/api/auth/logout')).status).toBe(204);
    expect((await agent.get('/api/auth/me')).status).toBe(401);
  });
});
