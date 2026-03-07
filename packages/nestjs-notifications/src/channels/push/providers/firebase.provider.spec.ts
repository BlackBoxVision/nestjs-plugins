const mockSend = jest.fn().mockResolvedValue('message-id-123');
const mockMessaging = jest.fn().mockReturnValue({ send: mockSend });
const mockInitializeApp = jest.fn().mockReturnValue({ messaging: mockMessaging });
const mockCert = jest.fn().mockReturnValue('mock-credential');

jest.mock('firebase-admin', () => ({
  initializeApp: mockInitializeApp,
  credential: { cert: mockCert },
}), { virtual: true });

import { FirebasePushProvider } from './firebase.provider';

describe('FirebasePushProvider', () => {
  const serviceAccountKey = {
    project_id: 'test-project',
    client_email: 'test@test.iam.gserviceaccount.com',
    private_key: '-----BEGIN PRIVATE KEY-----\nMOCK\n-----END PRIVATE KEY-----\n',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockSend.mockResolvedValue('message-id-123');
  });

  describe('constructor', () => {
    it('should initialize Firebase app with service account key', () => {
      const provider = new FirebasePushProvider({ serviceAccountKey });

      expect(mockCert).toHaveBeenCalledWith(serviceAccountKey);
      expect(mockInitializeApp).toHaveBeenCalledWith(
        { credential: 'mock-credential' },
        expect.stringContaining('notifications-'),
      );
    });
  });

  describe('send', () => {
    let provider: FirebasePushProvider;

    beforeEach(() => {
      provider = new FirebasePushProvider({ serviceAccountKey });
      jest.clearAllMocks();
      mockSend.mockResolvedValue('message-id-456');
    });

    it('should send basic push notification with token, title, and body', async () => {
      await provider.send({
        token: 'device-token-abc',
        title: 'Test Title',
        body: 'Test Body',
      });

      expect(mockMessaging).toHaveBeenCalled();
      expect(mockSend).toHaveBeenCalledWith({
        token: 'device-token-abc',
        notification: {
          title: 'Test Title',
          body: 'Test Body',
        },
      });
    });

    it('should include data when provided', async () => {
      await provider.send({
        token: 'device-token-abc',
        title: 'Data Test',
        body: 'With data',
        data: { key1: 'value1', key2: 'value2' },
      });

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { key1: 'value1', key2: 'value2' },
        }),
      );
    });

    it('should include android config when provided', async () => {
      const androidConfig = { priority: 'high', ttl: 3600 };

      await provider.send({
        token: 'device-token-abc',
        title: 'Android Test',
        body: 'With android',
        android: androidConfig,
      });

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          android: androidConfig,
        }),
      );
    });

    it('should include apns config when provided', async () => {
      const apnsConfig = { headers: { 'apns-priority': '10' } };

      await provider.send({
        token: 'device-token-abc',
        title: 'APNS Test',
        body: 'With apns',
        apns: apnsConfig,
      });

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          apns: apnsConfig,
        }),
      );
    });

    it('should include webpush config when provided', async () => {
      const webpushConfig = { headers: { Urgency: 'high' } };

      await provider.send({
        token: 'device-token-abc',
        title: 'WebPush Test',
        body: 'With webpush',
        webpush: webpushConfig,
      });

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          webpush: webpushConfig,
        }),
      );
    });

    it('should include all optional fields together', async () => {
      const data = { orderId: '123' };
      const android = { priority: 'high' };
      const apns = { headers: { 'apns-priority': '10' } };
      const webpush = { headers: { Urgency: 'high' } };

      await provider.send({
        token: 'device-token-abc',
        title: 'Full Test',
        body: 'All options',
        data,
        android,
        apns,
        webpush,
      });

      expect(mockSend).toHaveBeenCalledWith({
        token: 'device-token-abc',
        notification: {
          title: 'Full Test',
          body: 'All options',
        },
        data,
        android,
        apns,
        webpush,
      });
    });

    it('should not include optional fields when not provided', async () => {
      await provider.send({
        token: 'device-token-abc',
        title: 'Minimal',
        body: 'No extras',
      });

      const sentMessage = mockSend.mock.calls[0][0];

      expect(sentMessage).not.toHaveProperty('data');
      expect(sentMessage).not.toHaveProperty('android');
      expect(sentMessage).not.toHaveProperty('apns');
      expect(sentMessage).not.toHaveProperty('webpush');
    });

    it('should propagate errors from messaging send', async () => {
      mockSend.mockRejectedValue(new Error('Firebase send failed'));

      await expect(
        provider.send({
          token: 'invalid-token',
          title: 'Fail',
          body: 'Should fail',
        }),
      ).rejects.toThrow('Firebase send failed');
    });
  });
});
