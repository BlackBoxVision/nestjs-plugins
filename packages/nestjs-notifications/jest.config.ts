import type { Config } from 'jest';
import baseConfig from '../../jest.preset';

const config: Config = {
  ...baseConfig,
  displayName: 'nestjs-notifications',
  rootDir: '.',
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 90,
      lines: 88,
      statements: 88,
    },
  },
};

export default config;
