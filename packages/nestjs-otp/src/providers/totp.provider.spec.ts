import { OtpModuleOptions } from '../interfaces';
import { TotpProvider } from './totp.provider';

const options: OtpModuleOptions = {
  encryptionKey: 'test-encryption-key-32-chars-long',
  methods: {
    totp: {
      enabled: true,
      method: 'totp',
      issuer: 'TestApp',
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      backupCodesCount: 8,
    },
  },
};

describe('TotpProvider', () => {
  let provider: TotpProvider;

  beforeEach(() => {
    provider = new TotpProvider(options);
  });

  describe('createSetup', () => {
    it('should generate TOTP setup with QR code', async () => {
      const result = await provider.createSetup('user-1');

      expect(result.secret).toBeTruthy();
      expect(result.otpAuthUrl).toContain('otpauth://totp/');
      expect(result.otpAuthUrl).toContain('TestApp');
      expect(result.qrCodeDataUrl).toContain('data:image/png;base64');
      expect(result.encryptedSecret).toBeTruthy();
      expect(result.backupCodes).toHaveLength(8);
    });
  });

  describe('encryption/decryption', () => {
    it('should encrypt and decrypt secrets correctly', () => {
      const secret = 'JBSWY3DPEHPK3PXP';
      const encrypted = provider.encryptSecret(secret);
      const decrypted = provider.decryptSecret(encrypted);

      expect(decrypted).toBe(secret);
      expect(encrypted).not.toBe(secret);
    });

    it('should produce different ciphertexts for same secret (random IV)', () => {
      const secret = 'JBSWY3DPEHPK3PXP';
      const encrypted1 = provider.encryptSecret(secret);
      const encrypted2 = provider.encryptSecret(secret);

      expect(encrypted1).not.toBe(encrypted2);
    });
  });

  describe('verify', () => {
    it('should verify a valid TOTP code', async () => {
      const setup = await provider.createSetup('user-1');
      const OTPAuth = require('otpauth');
      const totp = new OTPAuth.TOTP({
        issuer: 'TestApp',
        algorithm: 'SHA1',
        digits: 6,
        period: 30,
        secret: OTPAuth.Secret.fromBase32(setup.secret),
      });
      const code = totp.generate();

      const result = await provider.verify(
        'user-1',
        code,
        setup.encryptedSecret,
      );
      expect(result).toBe(true);
    });

    it('should reject an invalid TOTP code', async () => {
      const setup = await provider.createSetup('user-1');

      const result = await provider.verify(
        'user-1',
        '000000',
        setup.encryptedSecret,
      );
      expect(result).toBe(false);
    });

    it('should return false when no secret provided', async () => {
      const result = await provider.verify('user-1', '123456');
      expect(result).toBe(false);
    });
  });

  describe('generate', () => {
    it('should throw - TOTP does not support direct code generation', async () => {
      await expect(provider.generate('user-1')).rejects.toThrow(
        'TOTP does not support code generation',
      );
    });
  });
});
