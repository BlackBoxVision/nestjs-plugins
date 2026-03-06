import type { Config } from 'jest';
import baseConfig from '../../jest.preset';

const config: Config = {
  ...baseConfig,
  coverageThreshold: {
    global: {
      branches: 25,
      functions: 35,
      lines: 35,
      statements: 40,
    },
  },
};

export default config;
