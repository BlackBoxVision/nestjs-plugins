export interface LoggerModuleOptions {
  level?: string;
  prettyPrint?: boolean;
  isGlobal?: boolean;
}

export interface LoggerModuleAsyncOptions {
  imports?: any[];
  isGlobal?: boolean;
  useFactory: (...args: any[]) => Promise<LoggerModuleOptions> | LoggerModuleOptions;
  inject?: any[];
}

export const LOGGER_MODULE_OPTIONS = 'LOGGER_MODULE_OPTIONS';
