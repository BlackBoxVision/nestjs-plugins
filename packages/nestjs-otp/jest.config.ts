import type { Config } from 'jest';
import baseConfig from '../../jest.preset';

const config: Config = {
  ...baseConfig,
  rootDir: '.',
  coverageThreshold: {
    global: {
      branches: 75,
      functions: 85,
      lines: 85,
      statements: 85,
    },
  },
};

export default config;
