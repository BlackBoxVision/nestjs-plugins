import type { Config } from 'jest';
import baseConfig from '../../jest.preset';

const config: Config = {
  ...baseConfig,
  displayName: 'nestjs-notifications',
  rootDir: '.',
  coverageThreshold: {
    global: {
      branches: 38,
      functions: 50,
      lines: 50,
      statements: 50,
    },
  },
};

export default config;
