const mockSendMail = jest.fn().mockResolvedValue({ messageId: 'test-id' });

jest.mock('nodemailer', () => ({
  createTransport: jest.fn().mockReturnValue({ sendMail: mockSendMail }),
}));

import * as nodemailer from 'nodemailer';
import { SmtpEmailProvider } from '../channels/email/providers/smtp.provider';
import type { SmtpProviderOptions } from '../interfaces';

const mockedNodemailer = nodemailer as jest.Mocked<typeof nodemailer>;

describe('SmtpEmailProvider', () => {
  let provider: SmtpEmailProvider;

  const defaultOptions: SmtpProviderOptions = {
    host: 'smtp.example.com',
    port: 587,
    secure: true,
    auth: { user: 'user@example.com', pass: 'password123' },
    from: 'default@example.com',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockSendMail.mockResolvedValue({ messageId: 'test-id' });
    provider = new SmtpEmailProvider(defaultOptions);
  });

  describe('constructor', () => {
    it('should create transporter with correct config', () => {
      expect(mockedNodemailer.createTransport).toHaveBeenCalledWith({
        host: 'smtp.example.com',
        port: 587,
        secure: true,
        auth: { user: 'user@example.com', pass: 'password123' },
      });
    });

    it('should default secure to false when not specified', () => {
      jest.clearAllMocks();

      const opts: SmtpProviderOptions = {
        host: 'smtp.example.com',
        port: 25,
        from: 'test@example.com',
      };

      new SmtpEmailProvider(opts);

      expect(mockedNodemailer.createTransport).toHaveBeenCalledWith({
        host: 'smtp.example.com',
        port: 25,
        secure: false,
        auth: undefined,
      });
    });
  });

  describe('send', () => {
    it('should send email with from/to/subject/html', async () => {
      await provider.send({
        to: 'recipient@example.com',
        subject: 'Test Subject',
        html: '<p>Hello World</p>',
      });

      expect(mockSendMail).toHaveBeenCalledWith({
        from: 'default@example.com',
        to: 'recipient@example.com',
        subject: 'Test Subject',
        html: '<p>Hello World</p>',
        text: undefined,
        replyTo: undefined,
        attachments: undefined,
      });
    });

    it('should join array recipients with comma', async () => {
      await provider.send({
        to: ['a@example.com', 'b@example.com', 'c@example.com'],
        subject: 'Multi Recipient',
        html: '<p>Multi</p>',
      });

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'a@example.com, b@example.com, c@example.com',
        }),
      );
    });

    it('should handle string recipient', async () => {
      await provider.send({
        to: 'single@example.com',
        subject: 'Single',
        html: '<p>Single</p>',
      });

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'single@example.com',
        }),
      );
    });

    it('should use custom from address when provided', async () => {
      await provider.send({
        to: 'test@example.com',
        subject: 'Custom From',
        html: '<p>Custom</p>',
        from: 'custom@example.com',
      });

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'custom@example.com',
        }),
      );
    });

    it('should pass text and replyTo options', async () => {
      await provider.send({
        to: 'test@example.com',
        subject: 'Full Options',
        html: '<p>Full</p>',
        text: 'Plain text version',
        replyTo: 'reply@example.com',
      });

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          text: 'Plain text version',
          replyTo: 'reply@example.com',
        }),
      );
    });

    it('should pass attachments', async () => {
      const attachments = [
        {
          filename: 'report.pdf',
          content: Buffer.from('pdf-content'),
          contentType: 'application/pdf',
        },
        {
          filename: 'image.png',
          content: 'base64-content',
        },
      ];

      await provider.send({
        to: 'test@example.com',
        subject: 'With Attachments',
        html: '<p>See attached</p>',
        attachments,
      });

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          attachments: [
            {
              filename: 'report.pdf',
              content: Buffer.from('pdf-content'),
              contentType: 'application/pdf',
            },
            {
              filename: 'image.png',
              content: 'base64-content',
              contentType: undefined,
            },
          ],
        }),
      );
    });

    it('should handle connection errors', async () => {
      mockSendMail.mockRejectedValueOnce(
        new Error('Connection refused: ECONNREFUSED'),
      );

      await expect(
        provider.send({
          to: 'test@example.com',
          subject: 'Error Test',
          html: '<p>Error</p>',
        }),
      ).rejects.toThrow('Connection refused: ECONNREFUSED');
    });

    it('should handle authentication errors', async () => {
      mockSendMail.mockRejectedValueOnce(
        new Error('Invalid login: 535 Authentication failed'),
      );

      await expect(
        provider.send({
          to: 'test@example.com',
          subject: 'Auth Error',
          html: '<p>Auth</p>',
        }),
      ).rejects.toThrow('Invalid login: 535 Authentication failed');
    });
  });
});
