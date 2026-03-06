import type { Config } from 'jest';
import baseConfig from '../../jest.preset';

const config: Config = {
  ...baseConfig,
  displayName: 'nestjs-notifications',
  rootDir: '.',
  coverageThreshold: {
    global: {
      branches: 15,
      functions: 5,
      lines: 15,
      statements: 15,
    },
  },
};

export default config;
