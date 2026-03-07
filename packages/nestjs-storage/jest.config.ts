import type { Config } from 'jest';
import baseConfig from '../../jest.preset';

const config: Config = {
  ...baseConfig,
  coverageThreshold: {
    global: {
      branches: 75,
      functions: 90,
      lines: 90,
      statements: 90,
    },
  },
};

export default config;
