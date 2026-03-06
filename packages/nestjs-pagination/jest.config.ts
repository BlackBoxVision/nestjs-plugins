import type { Config } from 'jest';
import baseConfig from '../../jest.preset';

const config: Config = {
  ...baseConfig,
  coverageThreshold: {
    global: {
      branches: 0,
      functions: 50,
      lines: 50,
      statements: 55,
    },
  },
};

export default config;
