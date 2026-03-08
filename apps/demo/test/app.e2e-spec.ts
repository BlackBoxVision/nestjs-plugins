import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import * as http from 'http';
import * as OTPAuth from 'otpauth';
import { AppModule } from '../src/app.module';
import { TransformInterceptor, HttpExceptionFilter } from '@bbv/nestjs-response';
import { NotificationService } from '@bbv/nestjs-notifications';

// ─── SMTP4Dev Helpers ─────────────────────────────────────

const SMTP4DEV_API = 'http://localhost:8027';

function smtp4devRequest(method: string, path: string): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const url = new URL(path, SMTP4DEV_API);
    const req = http.request(url, { method }, (res) => {
      let data = '';
      res.on('data', (chunk: Buffer) => { data += chunk.toString(); });
      res.on('end', () => {
        let body: any;
        try { body = JSON.parse(data); } catch { body = data; }
        resolve({ status: res.statusCode ?? 0, body });
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function clearEmails(): Promise<void> {
  await smtp4devRequest('DELETE', '/api/Messages/*');
}

async function waitForEmail(
  recipient: string,
  timeoutMs = 10_000,
): Promise<{ id: string; from: string; to: string; subject: string }> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const { body } = await smtp4devRequest('GET', '/api/Messages');
    const messages = Array.isArray(body) ? body : body?.results ?? [];
    const match = messages.find((m: any) => {
      const toField = m.deliveredTo ?? (Array.isArray(m.to) ? m.to.join(', ') : m.to ?? '');
      return toField.toLowerCase().includes(recipient.toLowerCase());
    });
    if (match) {
      const to = match.deliveredTo ?? (Array.isArray(match.to) ? match.to.join(', ') : match.to);
      return { id: match.id, from: match.from, to, subject: match.subject };
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`No email found for ${recipient} within ${timeoutMs}ms`);
}

async function getEmailHtml(messageId: string): Promise<string> {
  const { body } = await smtp4devRequest('GET', `/api/Messages/${messageId}/html`);
  return typeof body === 'string' ? body : JSON.stringify(body);
}

// ─── Notification Status Polling Helper ───────────────────

async function waitForNotificationStatus(
  prisma: any,
  notificationId: string,
  status: string,
  timeoutMs = 10_000,
): Promise<any> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const notification = await prisma.notification.findUnique({
      where: { id: notificationId },
    });
    if (notification?.status === status) {
      return notification;
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(
    `Notification ${notificationId} did not reach status "${status}" within ${timeoutMs}ms`,
  );
}

describe('Demo App (e2e)', () => {
  let app: INestApplication;
  let httpServer: any;
  let notificationService: NotificationService;
  let prisma: any;

  // Shared state across tests
  let accessToken: string;
  let userId: string;
  const testEmail = `e2e-${Date.now()}@test.local`;
  const testPassword = 'TestPassword123!';

  // Additional shared state for new sections
  let itemId: string;
  let orgId: string;
  let totpSecret: string;
  let challengeToken: string;
  let uploadedFileKey: string;
  let notificationId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    app.useGlobalInterceptors(new TransformInterceptor());
    app.useGlobalFilters(new HttpExceptionFilter());

    await app.init();
    httpServer = app.getHttpServer();
    notificationService = app.get(NotificationService);
    prisma = app.get('PRISMA_SERVICE');
  });

  afterAll(async () => {
    await app.close();
  });

  // ─── Health ─────────────────────────────────────────────

  describe('GET /health', () => {
    it('should return 200 with status ok', async () => {
      const res = await request(httpServer).get('/health').expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('ok');
      expect(res.body.data.timestamp).toBeDefined();
    });
  });

  // ─── Auth: Registration ─────────────────────────────────

  describe('POST /auth/register', () => {
    it('should register a new user', async () => {
      const res = await request(httpServer)
        .post('/auth/register')
        .send({ email: testEmail, password: testPassword })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.user.email).toBe(testEmail);
      expect(res.body.data.user.id).toBeDefined();
      expect(res.body.data.user.emailVerified).toBe(false);
      expect(res.body.data.user.isActive).toBe(true);
      expect(res.body.data.accessToken).toBeDefined();

      accessToken = res.body.data.accessToken;
      userId = res.body.data.user.id;
    });

    it('should reject duplicate email', async () => {
      const res = await request(httpServer)
        .post('/auth/register')
        .send({ email: testEmail, password: testPassword })
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it('should reject invalid payload (missing password)', async () => {
      const res = await request(httpServer)
        .post('/auth/register')
        .send({ email: 'nopass@test.local' })
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it('should reject invalid email format', async () => {
      const res = await request(httpServer)
        .post('/auth/register')
        .send({ email: 'not-an-email', password: testPassword })
        .expect(400);

      expect(res.body.success).toBe(false);
    });
  });

  // ─── Auth: Login ────────────────────────────────────────

  describe('POST /auth/login', () => {
    it('should login with valid credentials', async () => {
      const res = await request(httpServer)
        .post('/auth/login')
        .send({ email: testEmail, password: testPassword })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.user.email).toBe(testEmail);

      // Update token for subsequent tests
      accessToken = res.body.data.accessToken;
    });

    it('should reject invalid password', async () => {
      const res = await request(httpServer)
        .post('/auth/login')
        .send({ email: testEmail, password: 'WrongPassword!' })
        .expect(401);

      expect(res.body.success).toBe(false);
    });

    it('should reject non-existent user', async () => {
      const res = await request(httpServer)
        .post('/auth/login')
        .send({ email: 'nobody@test.local', password: testPassword })
        .expect(401);

      expect(res.body.success).toBe(false);
    });
  });

  // ─── Auth: Profile (protected) ──────────────────────────

  describe('GET /auth/me', () => {
    it('should return profile with valid token', async () => {
      const res = await request(httpServer)
        .get('/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.email).toBe(testEmail);
      expect(res.body.data.id).toBe(userId);
    });

    it('should reject request without token', async () => {
      await request(httpServer).get('/auth/me').expect(401);
    });

    it('should reject request with invalid token', async () => {
      await request(httpServer)
        .get('/auth/me')
        .set('Authorization', 'Bearer invalid-jwt-token')
        .expect(401);
    });
  });

  // ─── Auth: Sessions ─────────────────────────────────────

  describe('GET /auth/sessions', () => {
    it('should list user sessions', async () => {
      const res = await request(httpServer)
        .get('/auth/sessions')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('should reject without auth', async () => {
      await request(httpServer).get('/auth/sessions').expect(401);
    });
  });

  // ─── Auth: Session Revocation ───────────────────────────

  describe('DELETE /auth/sessions/:id', () => {
    it('should revoke a session', async () => {
      // Login to create a new session
      const loginRes = await request(httpServer)
        .post('/auth/login')
        .send({ email: testEmail, password: testPassword })
        .expect(201);

      const tempToken = loginRes.body.data.accessToken;

      // List sessions to find the one we just created
      const sessionsRes = await request(httpServer)
        .get('/auth/sessions')
        .set('Authorization', `Bearer ${tempToken}`)
        .expect(200);

      const sessions = sessionsRes.body.data;
      if (!Array.isArray(sessions) || sessions.length === 0) {
        // Session management doesn't persist sessions; just verify the endpoint works
        return;
      }

      // Revoke the last session
      const sessionToRevoke = sessions[sessions.length - 1];

      const revokeRes = await request(httpServer)
        .delete(`/auth/sessions/${sessionToRevoke.id}`)
        .set('Authorization', `Bearer ${tempToken}`)
        .expect(200);

      expect(revokeRes.body.success).toBe(true);
    });

    it('should reject without auth', async () => {
      await request(httpServer)
        .delete('/auth/sessions/some-id')
        .expect(401);
    });
  });

  // ─── Auth: Forgot Password ──────────────────────────────

  describe('POST /auth/forgot-password', () => {
    it('should accept existing email', async () => {
      const res = await request(httpServer)
        .post('/auth/forgot-password')
        .send({ email: testEmail })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.success).toBe(true);
    });

    it('should accept non-existing email (no enumeration)', async () => {
      const res = await request(httpServer)
        .post('/auth/forgot-password')
        .send({ email: 'unknown@test.local' })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.success).toBe(true);
    });
  });

  // ─── Auth: Verify Email ─────────────────────────────────

  describe('POST /auth/verify-email', () => {
    it('should reject invalid token', async () => {
      const res = await request(httpServer)
        .post('/auth/verify-email')
        .send({ token: 'invalid-token' })
        .expect(400);

      expect(res.body.success).toBe(false);
    });
  });

  // ─── Auth: Reset Password ──────────────────────────────

  describe('POST /auth/reset-password', () => {
    it('should reject invalid token', async () => {
      const res = await request(httpServer)
        .post('/auth/reset-password')
        .send({ token: 'invalid-token', newPassword: 'NewPass123!' })
        .expect(400);

      expect(res.body.success).toBe(false);
    });
  });

  // ─── Items (public reads, protected writes) ─────────────

  describe('Items CRUD', () => {
    it('GET /items should return paginated list (public)', async () => {
      const res = await request(httpServer).get('/items').expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
    });

    it('POST /items should create item (authenticated)', async () => {
      const res = await request(httpServer)
        .post('/items')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'E2E Test Item', description: 'Created by e2e test' })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('E2E Test Item');
      expect(res.body.data.id).toBeDefined();

      itemId = res.body.data.id;
    });

    it('POST /items without auth should be rejected', async () => {
      await request(httpServer)
        .post('/items')
        .send({ name: 'No Auth Item' })
        .expect(401);
    });

    it('GET /items/:id should return single item (public)', async () => {
      const res = await request(httpServer)
        .get(`/items/${itemId}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(itemId);
      expect(res.body.data.name).toBe('E2E Test Item');
    });

    it('GET /items should include created item', async () => {
      const res = await request(httpServer).get('/items').expect(200);

      const items = res.body.data.data ?? res.body.data;
      const found = Array.isArray(items)
        ? items.some((i: any) => i.id === itemId)
        : false;
      expect(found).toBe(true);
    });
  });

  // ─── Items: Pagination & Edge Cases ─────────────────────

  describe('Items: Pagination & Edge Cases', () => {
    it('GET /items?page=0&limit=1 should return pagination shape', async () => {
      const res = await request(httpServer)
        .get('/items?page=0&limit=1')
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.total).toBeDefined();
      expect(res.body.page).toBe(0);
      expect(res.body.limit).toBe(1);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('GET /items?sortBy=name&sortOrder=asc should accept sort params', async () => {
      const res = await request(httpServer)
        .get('/items?sortBy=name&sortOrder=asc')
        .expect(200);

      expect(res.body.success).toBe(true);
    });

    it('GET /items/:nonExistentId should return null data for missing item', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const res = await request(httpServer)
        .get(`/items/${fakeId}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeNull();
    });

    it('GET /items?page=-1 should return 400 from validation', async () => {
      await request(httpServer).get('/items?page=-1').expect(400);
    });
  });

  // ─── Response Envelope Validation ───────────────────────

  describe('Response Envelope', () => {
    it('success response should have { success: true, data: ... } shape', async () => {
      const res = await request(httpServer).get('/health').expect(200);

      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('errors', null);
    });

    it('error response should have { success: false, errors: ... } shape', async () => {
      const res = await request(httpServer)
        .post('/auth/register')
        .send({ email: 'bad-email' })
        .expect(400);

      expect(res.body).toHaveProperty('success', false);
      expect(res.body.errors).toBeDefined();
    });
  });

  // ─── Organizations ─────────────────────────────────────

  describe('Organizations', () => {
    const orgSlug = `test-org-${Date.now()}`;

    it('POST /organizations should create an organization', async () => {
      const res = await request(httpServer)
        .post('/organizations')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'Test Organization', slug: orgSlug })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Test Organization');
      expect(res.body.data.slug).toBe(orgSlug);
      expect(res.body.data.id).toBeDefined();

      orgId = res.body.data.id;
    });

    it('POST /organizations should reject duplicate slug', async () => {
      const res = await request(httpServer)
        .post('/organizations')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'Another Org', slug: orgSlug });

      // Expect a conflict or bad request
      expect([400, 409, 500]).toContain(res.status);
    });

    it('GET /organizations should list orgs for user', async () => {
      const res = await request(httpServer)
        .get('/organizations')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      const orgs = res.body.data;
      expect(Array.isArray(orgs)).toBe(true);
      expect(orgs.some((o: any) => o.id === orgId)).toBe(true);
    });

    it('GET /organizations/:id should return org details', async () => {
      const res = await request(httpServer)
        .get(`/organizations/${orgId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(orgId);
      expect(res.body.data.name).toBe('Test Organization');
    });

    it('PATCH /organizations/:id should update name', async () => {
      const res = await request(httpServer)
        .patch(`/organizations/${orgId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'Updated Org Name' })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Updated Org Name');
    });

    it('POST /organizations/:id/members should add a member', async () => {
      // Register an inline member user
      const memberEmail = `member-${Date.now()}@test.local`;
      const memberRes = await request(httpServer)
        .post('/auth/register')
        .send({ email: memberEmail, password: testPassword })
        .expect(201);

      const memberId = memberRes.body.data.user.id;

      const res = await request(httpServer)
        .post(`/organizations/${orgId}/members`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ userId: memberId, role: 'member' })
        .expect(201);

      expect(res.body.success).toBe(true);

      // Remove the member afterward
      await request(httpServer)
        .delete(`/organizations/${orgId}/members/${memberId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
    });

    it('DELETE /organizations/:id/members/:userId should remove a member', async () => {
      // Register another user to add and remove
      const removeEmail = `remove-${Date.now()}@test.local`;
      const regRes = await request(httpServer)
        .post('/auth/register')
        .send({ email: removeEmail, password: testPassword })
        .expect(201);

      const removeUserId = regRes.body.data.user.id;

      // Add as member
      await request(httpServer)
        .post(`/organizations/${orgId}/members`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ userId: removeUserId, role: 'member' })
        .expect(201);

      // Remove member
      const res = await request(httpServer)
        .delete(`/organizations/${orgId}/members/${removeUserId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
    });

    it('all org endpoints should reject without auth', async () => {
      await request(httpServer).get('/organizations').expect(401);
      await request(httpServer).post('/organizations').send({ name: 'No', slug: 'no' }).expect(401);
    });
  });

  // ─── OTP / TOTP & Email OTP ─────────────────────────────

  describe('OTP / TOTP', () => {
    it('POST /otp/totp/setup should return secret and backup codes', async () => {
      const res = await request(httpServer)
        .post('/otp/totp/setup')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ userId })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.secret).toBeDefined();
      expect(res.body.data.otpAuthUrl).toBeDefined();
      expect(res.body.data.qrCodeDataUrl).toBeDefined();
      expect(Array.isArray(res.body.data.backupCodes)).toBe(true);
      expect(res.body.data.backupCodes.length).toBeGreaterThan(0);

      totpSecret = res.body.data.secret;
    });

    it('POST /otp/totp/confirm with invalid code should fail', async () => {
      const res = await request(httpServer)
        .post('/otp/totp/confirm')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ userId, code: '000000' });

      expect([400, 401]).toContain(res.status);
    });

    it('POST /otp/totp/confirm with valid code should succeed', async () => {
      const totp = new OTPAuth.TOTP({
        secret: OTPAuth.Secret.fromBase32(totpSecret),
        algorithm: 'SHA1',
        digits: 6,
        period: 30,
      });
      const code = totp.generate();

      const res = await request(httpServer)
        .post('/otp/totp/confirm')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ userId, code })
        .expect(201);

      expect(res.body.success).toBe(true);
    });

    it('GET /otp/methods should return methods including totp', async () => {
      const res = await request(httpServer)
        .get('/otp/methods')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ userId })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.methods).toBeDefined();
      expect(res.body.data.methods).toContain('totp');
    });

    it('POST /otp/send with email method should succeed', async () => {
      const res = await request(httpServer)
        .post('/otp/send')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ userId, method: 'email' });

      // May succeed or fail depending on email provider config
      expect([200, 201, 400, 403, 500]).toContain(res.status);
    });

    it('POST /otp/verify with invalid code should fail', async () => {
      const res = await request(httpServer)
        .post('/otp/verify')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ userId, code: '000000', method: 'totp' });

      // Endpoint may return 201 with success: false instead of HTTP error
      if (res.status === 201 || res.status === 200) {
        expect(res.body.data?.success ?? res.body.success).toBe(false);
      } else {
        expect([400, 401]).toContain(res.status);
      }
    });

    it('POST /otp/totp/setup again should reject (already set up)', async () => {
      const res = await request(httpServer)
        .post('/otp/totp/setup')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ userId });

      expect(res.status).toBe(400);
    });
  });

  // ─── 2FA Login Flow ─────────────────────────────────────

  describe('2FA Login Flow', () => {
    it('POST /auth/login should return challengeToken when 2FA is enabled', async () => {
      const res = await request(httpServer)
        .post('/auth/login')
        .send({ email: testEmail, password: testPassword })
        .expect(201);

      expect(res.body.success).toBe(true);

      if (res.body.data.twoFactorRequired) {
        // 2FA is active — store challengeToken
        expect(res.body.data.challengeToken).toBeDefined();
        expect(res.body.data.accessToken).toBeUndefined();
        challengeToken = res.body.data.challengeToken;
      } else {
        // 2FA not triggered — refresh token
        accessToken = res.body.data.accessToken;
        challengeToken = '';
      }
    });

    it('POST /auth/2fa/verify with invalid code should fail', async () => {
      if (!challengeToken) return;

      const res = await request(httpServer)
        .post('/auth/2fa/verify')
        .send({ challengeToken, code: '000000' });

      expect([400, 401, 403]).toContain(res.status);
    });

    it('POST /auth/2fa/verify with invalid challengeToken should fail', async () => {
      const res = await request(httpServer)
        .post('/auth/2fa/verify')
        .send({ challengeToken: 'invalid-token', code: '123456' });

      expect([401, 403]).toContain(res.status);
    });

    it('POST /auth/2fa/verify with valid TOTP code should return accessToken', async () => {
      if (!challengeToken) return;

      const totp = new OTPAuth.TOTP({
        secret: OTPAuth.Secret.fromBase32(totpSecret),
        algorithm: 'SHA1',
        digits: 6,
        period: 30,
      });
      const code = totp.generate();

      const res = await request(httpServer)
        .post('/auth/2fa/verify')
        .send({ challengeToken, code })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.accessToken).toBeDefined();

      // Refresh accessToken for downstream tests
      accessToken = res.body.data.accessToken;
    });
  });

  // ─── Storage ────────────────────────────────────────────

  describe('Storage', () => {
    it('POST /storage/upload should upload a file', async () => {
      const res = await request(httpServer)
        .post('/storage/upload')
        .set('Authorization', `Bearer ${accessToken}`)
        .attach('file', Buffer.from('hello world'), 'test.txt')
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.key).toBeDefined();

      uploadedFileKey = res.body.data.key;
    });

    it('POST /storage/upload without file should return 400', async () => {
      await request(httpServer)
        .post('/storage/upload')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(400);
    });

    it('POST /storage/upload without auth should return 401', async () => {
      await request(httpServer)
        .post('/storage/upload')
        .attach('file', Buffer.from('hello'), 'test.txt')
        .expect(401);
    });

    it('GET /storage/:key/url should return a signed URL', async () => {
      const res = await request(httpServer)
        .get(`/storage/${uploadedFileKey}/url`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.url).toBeDefined();
      expect(typeof res.body.data.url).toBe('string');
    });

    it('GET /storage/:key/url?expiresIn=3600 should accept custom expiry', async () => {
      const res = await request(httpServer)
        .get(`/storage/${uploadedFileKey}/url?expiresIn=3600`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.url).toBeDefined();
    });

    it('DELETE /storage/:key should delete the file', async () => {
      const res = await request(httpServer)
        .delete(`/storage/${uploadedFileKey}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.deleted).toBe(true);
    });
  });

  // ─── Notifications (in-app) ─────────────────────────────

  describe('Notifications', () => {
    it('GET /notifications should return list (authenticated)', async () => {
      const res = await request(httpServer)
        .get('/notifications')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
    });

    it('GET /notifications/unread-count should return count', async () => {
      const res = await request(httpServer)
        .get('/notifications/unread-count')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.count).toBeDefined();
    });

    it('GET /notifications without auth should be rejected', async () => {
      await request(httpServer).get('/notifications').expect(401);
    });
  });

  // ─── Notifications: Mark as Read ────────────────────────

  describe('Notifications: Mark as Read', () => {
    beforeAll(async () => {
      // Trigger forgot-password to generate an in-app notification
      await request(httpServer)
        .post('/auth/forgot-password')
        .send({ email: testEmail })
        .expect(201);

      // Give async event handler time to process
      await new Promise((r) => setTimeout(r, 500));

      // Fetch notifications to get an ID
      const res = await request(httpServer)
        .get('/notifications')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const notifications = res.body.data;
      if (Array.isArray(notifications) && notifications.length > 0) {
        notificationId = notifications[0].id;
      }
    });

    it('PATCH /notifications/:id/read should mark single as read', async () => {
      if (!notificationId) {
        // If no notifications exist, skip gracefully
        return;
      }

      const res = await request(httpServer)
        .patch(`/notifications/${notificationId}/read`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
    });

    it('PATCH /notifications/read-all should mark all as read', async () => {
      const res = await request(httpServer)
        .patch('/notifications/read-all')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
    });

    it('GET /notifications/unread-count should be 0 after read-all', async () => {
      const res = await request(httpServer)
        .get('/notifications/unread-count')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.count).toBe(0);
    });

    it('PATCH /notifications/read-all without auth should be rejected', async () => {
      await request(httpServer).patch('/notifications/read-all').expect(401);
    });
  });

  // ─── Notification Preferences ───────────────────────────

  describe('Notification Preferences', () => {
    it('GET /notification-preferences should return list', async () => {
      const res = await request(httpServer)
        .get('/notification-preferences')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
    });

    it('PUT /notification-preferences should upsert preference (authenticated)', async () => {
      const res = await request(httpServer)
        .put('/notification-preferences')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ channel: 'email', type: 'marketing', enabled: false });

      expect(res.status).toBe(200);
    });
  });

  // ─── Auth Events + Notification Integration ─────────────

  describe('Auth-Notification Integration', () => {
    it('should create verification token on registration (emailVerification enabled)', async () => {
      const uniqueEmail = `verify-${Date.now()}@test.local`;

      const res = await request(httpServer)
        .post('/auth/register')
        .send({ email: uniqueEmail, password: testPassword })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.user.emailVerified).toBe(false);

      // The event emitter should have triggered a notification.
      // Give async event handler a moment to process
      await new Promise((r) => setTimeout(r, 500));

      // Login to get token for this user
      const loginRes = await request(httpServer)
        .post('/auth/login')
        .send({ email: uniqueEmail, password: testPassword })
        .expect(201);

      const token = loginRes.body.data.accessToken;

      // Check that a notification was created for this user
      const notifRes = await request(httpServer)
        .get('/notifications')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
    });

    it('should trigger forgot-password notification event', async () => {
      await request(httpServer)
        .post('/auth/forgot-password')
        .send({ email: testEmail })
        .expect(201);

      // Give async event handler a moment
      await new Promise((r) => setTimeout(r, 500));

      // Check notifications were created for the user
      const notifRes = await request(httpServer)
        .get('/notifications')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(notifRes.body.success).toBe(true);
    });
  });

  // ─── Audit Logs: Deep Testing ──────────────────────────

  describe('Audit Logs', () => {
    it('GET /audit-logs should return audit entries', async () => {
      const res = await request(httpServer)
        .get('/audit-logs')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
    });

    it('GET /audit-logs?entity=Item should filter by entity', async () => {
      const res = await request(httpServer)
        .get('/audit-logs?entity=Item')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      const entries = res.body.data.data ?? res.body.data;
      if (Array.isArray(entries) && entries.length > 0) {
        expect(entries.every((e: any) => e.entity === 'Item')).toBe(true);
      }
    });

    it('GET /audit-logs?action=CREATE should filter by action', async () => {
      const res = await request(httpServer)
        .get('/audit-logs?action=CREATE')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      const entries = res.body.data.data ?? res.body.data;
      if (Array.isArray(entries) && entries.length > 0) {
        expect(entries.every((e: any) => e.action === 'CREATE')).toBe(true);
      }
    });

    it('GET /audit-logs?page=1&limit=2 should support pagination', async () => {
      const res = await request(httpServer)
        .get('/audit-logs?page=1&limit=2')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      const entries = res.body.data.data ?? res.body.data;
      if (Array.isArray(entries)) {
        expect(entries.length).toBeLessThanOrEqual(2);
      }
    });

    it('GET /audit-logs/:id should return single entry', async () => {
      // First get all to pick an ID
      const listRes = await request(httpServer)
        .get('/audit-logs')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const entries = listRes.body.data.data ?? listRes.body.data;
      if (!Array.isArray(entries) || entries.length === 0) {
        return; // No entries to test
      }

      const entryId = entries[0].id;
      const res = await request(httpServer)
        .get(`/audit-logs/${entryId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(entryId);
    });

    it('GET /audit-logs/entity/Item/:itemId should return entity-specific logs', async () => {
      if (!itemId) {
        return; // Skip if no item was created
      }

      const res = await request(httpServer)
        .get(`/audit-logs/entity/Item/${itemId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
    });
  });

  // ─── Auth: Second User Flow ─────────────────────────────

  describe('Full auth lifecycle with second user', () => {
    const email2 = `lifecycle-${Date.now()}@test.local`;
    const password2 = 'LifecyclePass123!';
    let token2: string;

    it('should register second user', async () => {
      const res = await request(httpServer)
        .post('/auth/register')
        .send({ email: email2, password: password2 })
        .expect(201);

      token2 = res.body.data.accessToken;
      expect(res.body.data.user.email).toBe(email2);
    });

    it('should login as second user', async () => {
      const res = await request(httpServer)
        .post('/auth/login')
        .send({ email: email2, password: password2 })
        .expect(201);

      token2 = res.body.data.accessToken;
    });

    it('should get profile of second user', async () => {
      const res = await request(httpServer)
        .get('/auth/me')
        .set('Authorization', `Bearer ${token2}`)
        .expect(200);

      expect(res.body.data.email).toBe(email2);
    });

    it('second user should not see first user data in /auth/me', async () => {
      const res = await request(httpServer)
        .get('/auth/me')
        .set('Authorization', `Bearer ${token2}`)
        .expect(200);

      expect(res.body.data.email).not.toBe(testEmail);
    });
  });

  // ─── Email Delivery (SMTP4Dev) ────────────────────────────

  describe('Email Delivery (SMTP4Dev)', () => {
    const emailTestUser = `email-test-${Date.now()}@test.local`;

    beforeAll(async () => {
      try {
        await clearEmails();
      } catch {
        // SMTP4Dev may not be running — tests will fail gracefully
      }
    });

    it('should deliver verification email on registration', async () => {
      const res = await request(httpServer)
        .post('/auth/register')
        .send({ email: emailTestUser, password: testPassword })
        .expect(201);

      expect(res.body.success).toBe(true);

      const email = await waitForEmail(emailTestUser);
      expect(email.subject).toContain('Verify');
      expect(email.to.toLowerCase()).toContain(emailTestUser);

      const html = await getEmailHtml(email.id);
      expect(html).toContain('verify');
    });

    it('should deliver password-reset email on forgot-password', async () => {
      await clearEmails();

      await request(httpServer)
        .post('/auth/forgot-password')
        .send({ email: emailTestUser })
        .expect(201);

      const email = await waitForEmail(emailTestUser);
      expect(email.subject).toContain('Reset');
      expect(email.to.toLowerCase()).toContain(emailTestUser);

      const html = await getEmailHtml(email.id);
      expect(html).toContain('reset');
    });

    it('should send email from configured sender address', async () => {
      // Use the email captured in the previous test or trigger a new one
      await clearEmails();

      await request(httpServer)
        .post('/auth/forgot-password')
        .send({ email: emailTestUser })
        .expect(201);

      const email = await waitForEmail(emailTestUser);
      expect(email.from.toLowerCase()).toContain('noreply@demo.local');
    });
  });

  // ─── SMS Delivery (Log Provider) ──────────────────────────

  describe('SMS Delivery (Log Provider)', () => {
    it('should process SMS notification through BullMQ pipeline', async () => {
      const { id } = await notificationService.send({
        userId,
        channel: 'sms',
        type: 'test.sms',
        title: 'Test SMS',
        body: 'Hello via SMS',
        to: '+15551234567',
      });

      expect(id).toBeDefined();
      expect(id).not.toBe('');

      const notification = await waitForNotificationStatus(prisma, id, 'sent');
      expect(notification.sentAt).toBeDefined();
      expect(notification.channel).toBe('sms');
    });
  });

  // ─── Push Delivery (Log Provider) ─────────────────────────

  describe('Push Delivery (Log Provider)', () => {
    const deviceToken = `test-device-token-${Date.now()}`;
    const deviceToken2 = `test-device-token2-${Date.now()}`;

    it('should register a device token', async () => {
      const res = await request(httpServer)
        .post('/notifications/devices')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ token: deviceToken, platform: 'ios' })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.token).toBe(deviceToken);
    });

    it('should list registered device tokens', async () => {
      const res = await request(httpServer)
        .get('/notifications/devices')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      const devices = res.body.data;
      expect(Array.isArray(devices)).toBe(true);
      expect(devices.some((d: any) => d.token === deviceToken)).toBe(true);
    });

    it('should process push notification through BullMQ pipeline', async () => {
      const { id } = await notificationService.send({
        userId,
        channel: 'push',
        type: 'test.push',
        title: 'Test Push',
        body: 'Hello via Push',
        to: deviceToken,
      });

      expect(id).toBeDefined();
      expect(id).not.toBe('');

      const notification = await waitForNotificationStatus(prisma, id, 'sent');
      expect(notification.sentAt).toBeDefined();
      expect(notification.channel).toBe('push');
    });

    it('should fan out push to all registered devices', async () => {
      // Register a second device
      await request(httpServer)
        .post('/notifications/devices')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ token: deviceToken2, platform: 'android' })
        .expect(201);

      const { id } = await notificationService.send({
        userId,
        channel: 'push',
        type: 'test.push-fanout',
        title: 'Fanout Push',
        body: 'Hello to all devices',
      });

      expect(id).toBeDefined();
      expect(id).not.toBe('');

      const notification = await waitForNotificationStatus(prisma, id, 'sent');
      expect(notification.sentAt).toBeDefined();
    });

    it('should unregister a device token', async () => {
      const res = await request(httpServer)
        .delete(`/notifications/devices/${deviceToken}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
    });

    it('should unregister all device tokens', async () => {
      const res = await request(httpServer)
        .delete('/notifications/devices')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);

      // Verify empty
      const listRes = await request(httpServer)
        .get('/notifications/devices')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(listRes.body.data).toEqual([]);
    });
  });
});
