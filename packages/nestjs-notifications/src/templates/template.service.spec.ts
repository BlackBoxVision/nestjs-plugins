import * as fs from 'fs';
import * as Handlebars from 'handlebars';
import { TemplateService } from './template.service';
import type { NotificationModuleOptions } from '../interfaces';

jest.mock('fs', () => ({
  existsSync: jest.fn(),
  readFileSync: jest.fn(),
}));

jest.mock('handlebars', () => ({
  compile: jest.fn().mockReturnValue((data: any) => `rendered:${JSON.stringify(data)}`),
}));

const mockedFs = fs as jest.Mocked<typeof fs>;
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
    it('should compile template with Handlebars', () => {
      mockedFs.existsSync.mockReturnValue(false);
      // Make the defaults dir path match
      mockedFs.existsSync.mockImplementation((p: any) => {
        return String(p).includes('defaults');
      });
      mockedFs.readFileSync.mockReturnValue('<h1>{{name}}</h1>' as any);

      service = new (TemplateService as any)(createOptions());

      const result = service.render('welcome', 'email', { name: 'John' });

      expect(mockedHandlebars.compile).toHaveBeenCalledWith('<h1>{{name}}</h1>');
      expect(result).toBe('rendered:{"name":"John"}');
    });

    it('should cache compiled templates', () => {
      mockedFs.existsSync.mockImplementation((p: any) => {
        return String(p).includes('defaults');
      });
      mockedFs.readFileSync.mockReturnValue('<p>{{msg}}</p>' as any);

      service = new (TemplateService as any)(createOptions());

      service.render('cached', 'email', { msg: 'first' });
      service.render('cached', 'email', { msg: 'second' });

      // Handlebars.compile should only be called once for the same template
      expect(mockedHandlebars.compile).toHaveBeenCalledTimes(1);
      // readFileSync should also only be called once
      expect(mockedFs.readFileSync).toHaveBeenCalledTimes(1);
    });

    it('should not cache different templates under the same key', () => {
      mockedFs.existsSync.mockImplementation((p: any) => {
        return String(p).includes('defaults');
      });
      mockedFs.readFileSync.mockReturnValue('<p>template</p>' as any);

      service = new (TemplateService as any)(createOptions());

      service.render('template-a', 'email', {});
      service.render('template-b', 'email', {});

      expect(mockedHandlebars.compile).toHaveBeenCalledTimes(2);
    });
  });

  describe('loadTemplate (via render)', () => {
    it('should load from project templateDir/channel/name.hbs first', () => {
      mockedFs.existsSync.mockImplementation((p: any) => {
        return String(p).includes('/custom/templates/email/welcome.hbs');
      });
      mockedFs.readFileSync.mockReturnValue('<p>project template</p>' as any);

      service = new (TemplateService as any)(
        createOptions('/custom/templates'),
      );

      service.render('welcome', 'email', {});

      expect(mockedFs.readFileSync).toHaveBeenCalledWith(
        '/custom/templates/email/welcome.hbs',
        'utf-8',
      );
    });

    it('should fall back to project templateDir/name.hbs', () => {
      mockedFs.existsSync.mockImplementation((p: any) => {
        const pathStr = String(p);
        // channel subdirectory does not exist, flat path does
        if (pathStr === '/custom/templates/email/welcome.hbs') return false;
        if (pathStr === '/custom/templates/welcome.hbs') return true;
        return false;
      });
      mockedFs.readFileSync.mockReturnValue('<p>flat template</p>' as any);

      service = new (TemplateService as any)(
        createOptions('/custom/templates'),
      );

      service.render('welcome', 'email', {});

      expect(mockedFs.readFileSync).toHaveBeenCalledWith(
        '/custom/templates/welcome.hbs',
        'utf-8',
      );
    });

    it('should fall back to defaults when project template not found', () => {
      mockedFs.existsSync.mockImplementation((p: any) => {
        return String(p).includes('defaults');
      });
      mockedFs.readFileSync.mockReturnValue('<p>default</p>' as any);

      service = new (TemplateService as any)(
        createOptions('/custom/templates'),
      );

      service.render('welcome', 'email', {});

      expect(mockedFs.readFileSync).toHaveBeenCalledWith(
        expect.stringContaining('defaults/welcome.hbs'),
        'utf-8',
      );
    });

    it('should throw when template not found anywhere', () => {
      mockedFs.existsSync.mockReturnValue(false);

      service = new (TemplateService as any)(createOptions());

      expect(() => service.render('nonexistent', 'email', {})).toThrow(
        'Template "nonexistent" not found for channel "email"',
      );
    });

    it('should add .hbs extension if not present', () => {
      mockedFs.existsSync.mockImplementation((p: any) => {
        return String(p).includes('defaults');
      });
      mockedFs.readFileSync.mockReturnValue('<p>ext test</p>' as any);

      service = new (TemplateService as any)(createOptions());

      service.render('mytemplate', 'email', {});

      // The path checked should end with .hbs
      const calls = (mockedFs.existsSync as jest.Mock).mock.calls;
      const checkedPaths = calls.map((c: any[]) => String(c[0]));
      const defaultCheck = checkedPaths.find((p: string) =>
        p.includes('defaults'),
      );
      expect(defaultCheck).toMatch(/mytemplate\.hbs$/);
    });

    it('should not double .hbs extension when already present', () => {
      mockedFs.existsSync.mockImplementation((p: any) => {
        return String(p).includes('defaults');
      });
      mockedFs.readFileSync.mockReturnValue('<p>hbs test</p>' as any);

      service = new (TemplateService as any)(createOptions());

      service.render('mytemplate.hbs', 'email', {});

      const calls = (mockedFs.existsSync as jest.Mock).mock.calls;
      const checkedPaths = calls.map((c: any[]) => String(c[0]));
      // Should not contain .hbs.hbs
      checkedPaths.forEach((p: string) => {
        expect(p).not.toMatch(/\.hbs\.hbs$/);
      });
    });
  });

  describe('constructor', () => {
    it('should set projectDir when email templateDir is configured', () => {
      service = new (TemplateService as any)(
        createOptions('/my/templates'),
      );

      // Verify by attempting render with project path
      mockedFs.existsSync.mockImplementation((p: any) => {
        return String(p).startsWith('/my/templates');
      });
      mockedFs.readFileSync.mockReturnValue('<p>test</p>' as any);

      service.render('test', 'email', {});

      expect(mockedFs.existsSync).toHaveBeenCalledWith(
        '/my/templates/email/test.hbs',
      );
    });

    it('should not set projectDir when email is disabled', () => {
      const options: NotificationModuleOptions = {
        channels: {
          email: { enabled: false as const },
        },
      };

      service = new (TemplateService as any)(options);

      mockedFs.existsSync.mockReturnValue(false);

      // Should only check defaults, not any project dir
      expect(() => service.render('test', 'email', {})).toThrow(
        'Template "test" not found for channel "email"',
      );
    });
  });
});
