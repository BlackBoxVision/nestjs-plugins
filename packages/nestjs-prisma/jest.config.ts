import type { Config } from 'jest';
import baseConfig from '../../jest.preset';

const config: Config = {
  ...baseConfig,
  coverageThreshold: {
    global: {
      branches: 75,
      functions: 65,
      lines: 80,
      statements: 80,
    },
  },
};

export default config;
