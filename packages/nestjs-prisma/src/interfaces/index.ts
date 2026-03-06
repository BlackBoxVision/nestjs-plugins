export interface PrismaModuleOptions {
  isGlobal?: boolean;
  prismaServiceOptions?: {
    explicitConnect?: boolean;
    middlewares?: Array<(...args: any[]) => any>;
  };
}

export interface PrismaModuleAsyncOptions {
  isGlobal?: boolean;
  imports?: any[];
  useFactory?: (...args: any[]) => Promise<PrismaModuleOptions> | PrismaModuleOptions;
  inject?: any[];
}
