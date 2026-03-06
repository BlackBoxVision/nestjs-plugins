import type { Config } from 'jest';
import baseConfig from '../../jest.preset';

const config: Config = {
  ...baseConfig,
  coverageThreshold: {
    global: {
      branches: 10,
      functions: 50,
      lines: 25,
      statements: 20,
    },
  },
};

export default config;
