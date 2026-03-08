import * as fs from 'fs';
import * as Handlebars from 'handlebars';
import { TemplateService } from './template.service';
import type { NotificationModuleOptions } from '../interfaces';

jest.mock('fs', () => ({
  promises: {
    access: jest.fn(),
    readFile: jest.fn(),
  },
}));

jest.mock('handlebars', () => ({
  compile: jest.fn().mockReturnValue((data: any) => `rendered:${JSON.stringify(data)}`),
}));

const mockedFsPromises = fs.promises as jest.Mocked<typeof fs.promises>;
const mockedHandlebars = Handlebars as jest.Mocked<typeof Handlebars>;

describe('TemplateService', () => {
  let service: TemplateService;

  const createOptions = (
    templateDir?: string,
  ): NotificationModuleOptions => ({
    channels: {
      email: templateDir
        ? {
            enabled: true as const,
            provider: 'smtp' as const,
            providerOptions: {
              host: 'localhost',
              port: 587,
              from: 'test@test.com',
            },
            templateDir,
          }
        : {
            enabled: true as const,
            provider: 'smtp' as const,
            providerOptions: {
              host: 'localhost',
              port: 587,
              from: 'test@test.com',
            },
          },
    },
  });

  beforeEach(() => {
    jest.clearAllMocks();
    (mockedHandlebars.compile as jest.Mock).mockReturnValue(
      (data: any) => `rendered:${JSON.stringify(data)}`,
    );
  });

  describe('render', () => {
    it('should compile template with Handlebars', async () => {
      // Make the defaults dir path match via access (no throw = exists)
      (mockedFsPromises.access as jest.Mock).mockImplementation((p: any) => {
        if (String(p).includes('defaults')) return Promise.resolve();
        return Promise.reject(new Error('ENOENT'));
      });
      (mockedFsPromises.readFile as jest.Mock).mockResolvedValue('<h1>{{name}}</h1>');

      service = new (TemplateService as any)(createOptions());

      const result = await service.render('welcome', 'email', { name: 'John' });

      expect(mockedHandlebars.compile).toHaveBeenCalledWith('<h1>{{name}}</h1>');
      expect(result).toBe('rendered:{"name":"John"}');
    });

    it('should cache compiled templates', async () => {
      (mockedFsPromises.access as jest.Mock).mockImplementation((p: any) => {
        if (String(p).includes('defaults')) return Promise.resolve();
        return Promise.reject(new Error('ENOENT'));
      });
      (mockedFsPromises.readFile as jest.Mock).mockResolvedValue('<p>{{msg}}</p>');

      service = new (TemplateService as any)(createOptions());

      await service.render('cached', 'email', { msg: 'first' });
      await service.render('cached', 'email', { msg: 'second' });

      // Handlebars.compile should only be called once for the same template
      expect(mockedHandlebars.compile).toHaveBeenCalledTimes(1);
      // readFile should also only be called once
      expect(mockedFsPromises.readFile).toHaveBeenCalledTimes(1);
    });

    it('should not cache different templates under the same key', async () => {
      (mockedFsPromises.access as jest.Mock).mockImplementation((p: any) => {
        if (String(p).includes('defaults')) return Promise.resolve();
        return Promise.reject(new Error('ENOENT'));
      });
      (mockedFsPromises.readFile as jest.Mock).mockResolvedValue('<p>template</p>');

      service = new (TemplateService as any)(createOptions());

      await service.render('template-a', 'email', {});
      await service.render('template-b', 'email', {});

      expect(mockedHandlebars.compile).toHaveBeenCalledTimes(2);
    });
  });

  describe('loadTemplate (via render)', () => {
    it('should load from project templateDir/channel/name.hbs first', async () => {
      (mockedFsPromises.access as jest.Mock).mockImplementation((p: any) => {
        if (String(p).includes('/custom/templates/email/welcome.hbs')) return Promise.resolve();
        return Promise.reject(new Error('ENOENT'));
      });
      (mockedFsPromises.readFile as jest.Mock).mockResolvedValue('<p>project template</p>');

      service = new (TemplateService as any)(
        createOptions('/custom/templates'),
      );

      await service.render('welcome', 'email', {});

      expect(mockedFsPromises.readFile).toHaveBeenCalledWith(
        '/custom/templates/email/welcome.hbs',
        'utf-8',
      );
    });

    it('should fall back to project templateDir/name.hbs', async () => {
      (mockedFsPromises.access as jest.Mock).mockImplementation((p: any) => {
        const pathStr = String(p);
        // channel subdirectory does not exist, flat path does
        if (pathStr === '/custom/templates/email/welcome.hbs') return Promise.reject(new Error('ENOENT'));
        if (pathStr === '/custom/templates/welcome.hbs') return Promise.resolve();
        return Promise.reject(new Error('ENOENT'));
      });
      (mockedFsPromises.readFile as jest.Mock).mockResolvedValue('<p>flat template</p>');

      service = new (TemplateService as any)(
        createOptions('/custom/templates'),
      );

      await service.render('welcome', 'email', {});

      expect(mockedFsPromises.readFile).toHaveBeenCalledWith(
        '/custom/templates/welcome.hbs',
        'utf-8',
      );
    });

    it('should fall back to defaults when project template not found', async () => {
      (mockedFsPromises.access as jest.Mock).mockImplementation((p: any) => {
        if (String(p).includes('defaults')) return Promise.resolve();
        return Promise.reject(new Error('ENOENT'));
      });
      (mockedFsPromises.readFile as jest.Mock).mockResolvedValue('<p>default</p>');

      service = new (TemplateService as any)(
        createOptions('/custom/templates'),
      );

      await service.render('welcome', 'email', {});

      expect(mockedFsPromises.readFile).toHaveBeenCalledWith(
        expect.stringContaining('defaults/welcome.hbs'),
        'utf-8',
      );
    });

    it('should throw BadRequestException for path traversal in template name', async () => {
      service = new (TemplateService as any)(createOptions('/custom/templates'));

      await expect(service.render('../../../etc/passwd', 'email', {})).rejects.toThrow(
        'path traversal is not allowed',
      );
    });

    it('should throw BadRequestException for embedded path traversal', async () => {
      service = new (TemplateService as any)(createOptions('/custom/templates'));

      await expect(service.render('foo/../../bar', 'email', {})).rejects.toThrow(
        'path traversal is not allowed',
      );
    });

    it('should throw when template not found anywhere', async () => {
      (mockedFsPromises.access as jest.Mock).mockRejectedValue(new Error('ENOENT'));

      service = new (TemplateService as any)(createOptions());

      await expect(service.render('nonexistent', 'email', {})).rejects.toThrow(
        'Template "nonexistent" not found for channel "email"',
      );
    });

    it('should add .hbs extension if not present', async () => {
      (mockedFsPromises.access as jest.Mock).mockImplementation((p: any) => {
        if (String(p).includes('defaults')) return Promise.resolve();
        return Promise.reject(new Error('ENOENT'));
      });
      (mockedFsPromises.readFile as jest.Mock).mockResolvedValue('<p>ext test</p>');

      service = new (TemplateService as any)(createOptions());

      await service.render('mytemplate', 'email', {});

      // The path checked should end with .hbs
      const calls = (mockedFsPromises.access as jest.Mock).mock.calls;
      const checkedPaths = calls.map((c: any[]) => String(c[0]));
      const defaultCheck = checkedPaths.find((p: string) =>
        p.includes('defaults'),
      );
      expect(defaultCheck).toMatch(/mytemplate\.hbs$/);
    });

    it('should not double .hbs extension when already present', async () => {
      (mockedFsPromises.access as jest.Mock).mockImplementation((p: any) => {
        if (String(p).includes('defaults')) return Promise.resolve();
        return Promise.reject(new Error('ENOENT'));
      });
      (mockedFsPromises.readFile as jest.Mock).mockResolvedValue('<p>hbs test</p>');

      service = new (TemplateService as any)(createOptions());

      await service.render('mytemplate.hbs', 'email', {});

      const calls = (mockedFsPromises.access as jest.Mock).mock.calls;
      const checkedPaths = calls.map((c: any[]) => String(c[0]));
      // Should not contain .hbs.hbs
      checkedPaths.forEach((p: string) => {
        expect(p).not.toMatch(/\.hbs\.hbs$/);
      });
    });
  });

  describe('constructor', () => {
    it('should set projectDir when email templateDir is configured', async () => {
      service = new (TemplateService as any)(
        createOptions('/my/templates'),
      );

      // Verify by attempting render with project path
      (mockedFsPromises.access as jest.Mock).mockImplementation((p: any) => {
        if (String(p).startsWith('/my/templates')) return Promise.resolve();
        return Promise.reject(new Error('ENOENT'));
      });
      (mockedFsPromises.readFile as jest.Mock).mockResolvedValue('<p>test</p>');

      await service.render('test', 'email', {});

      expect(mockedFsPromises.access).toHaveBeenCalledWith(
        '/my/templates/email/test.hbs',
      );
    });

    it('should not set projectDir when email is disabled', async () => {
      const options: NotificationModuleOptions = {
        channels: {
          email: { enabled: false as const },
        },
      };

      service = new (TemplateService as any)(options);

      (mockedFsPromises.access as jest.Mock).mockRejectedValue(new Error('ENOENT'));

      // Should only check defaults, not any project dir
      await expect(service.render('test', 'email', {})).rejects.toThrow(
        'Template "test" not found for channel "email"',
      );
    });
  });
});
