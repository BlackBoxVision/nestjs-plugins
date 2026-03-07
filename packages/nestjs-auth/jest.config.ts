import type { Config } from 'jest';
import baseConfig from '../../jest.preset';

const config: Config = {
  ...baseConfig,
  rootDir: '.',
  coverageThreshold: {
    global: {
      branches: 50,
      functions: 55,
      lines: 65,
      statements: 65,
    },
  },
};

export default config;
