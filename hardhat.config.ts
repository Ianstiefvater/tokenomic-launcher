// hardhat.config.ts
import { HardhatUserConfig } from 'hardhat/config';
import '@nomicfoundation/hardhat-toolbox';
import path from 'path';

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      },
      viaIR: true
    }
  },
  paths: {
    sources: './clients/',
    tests: './test',
    cache: './cache',
    artifacts: './artifacts',
  },
  mocha: {
    reporter: "json"
  }
};

export default config;