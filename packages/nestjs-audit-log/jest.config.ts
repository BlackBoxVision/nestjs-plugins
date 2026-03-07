import type { Config } from 'jest';
import baseConfig from '../../jest.preset';

const config: Config = {
  ...baseConfig,
  rootDir: '.',
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 90,
      statements: 90,
    },
  },
};

export default config;
