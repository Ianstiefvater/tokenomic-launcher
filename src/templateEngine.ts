// src/templateEngine.ts
import ejs from 'ejs';
import fs from 'fs';
import path from 'path';
import { TEMPLATES_DIR } from './config';

export function renderTemplates(inputs: any): { contract: string } {
  // Render the base ERC20 template (always required)
  const baseERC20Template = fs.readFileSync(path.join(TEMPLATES_DIR, 'baseERC20.sol.ejs'), 'utf-8');
  const baseERC20 = ejs.render(baseERC20Template, inputs);

  // Initialize contract code with the base contract
  let contractCode = baseERC20 + "\n\n";

  // Conditionally add Vesting module
  if (inputs.enableVesting) {
    const vestingTemplate = fs.readFileSync(path.join(TEMPLATES_DIR, 'vestingModule.sol.ejs'), 'utf-8');
    const vestingModule = ejs.render(vestingTemplate, inputs);
    contractCode += vestingModule + "\n\n";
  }

  // Conditionally add Deflation module
  if (inputs.enableDeflation) {
    const deflationTemplate = fs.readFileSync(path.join(TEMPLATES_DIR, 'deflationModule.sol.ejs'), 'utf-8');
    const deflationModule = ejs.render(deflationTemplate, inputs);
    contractCode += deflationModule + "\n\n";
  }

  // Conditionally add Inflation module
  if (inputs.enableInflation) {
    const inflationTemplate = fs.readFileSync(path.join(TEMPLATES_DIR, 'inflationModule.sol.ejs'), 'utf-8');
    const inflationModule = ejs.render(inflationTemplate, inputs);
    contractCode += inflationModule + "\n\n";
  }

  // Conditionally add Fee module if transaction fee is enabled
  if (inputs.enableTransactionFee) {
    const feeTemplate = fs.readFileSync(path.join(TEMPLATES_DIR, 'feeModule.sol.ejs'), 'utf-8');
    const feeModule = ejs.render(feeTemplate, inputs);
    contractCode += feeModule + "\n\n";
  }

  // Conditionally add Staking module
  if (inputs.enableStaking) {
    const stakingTemplate = fs.readFileSync(path.join(TEMPLATES_DIR, 'stakingModule.sol.ejs'), 'utf-8');
    const stakingModule = ejs.render(stakingTemplate, inputs);
    contractCode += stakingModule + "\n\n";
  }

  // Conditionally add Governance module
  if (inputs.enableGovernance) {
    const governanceTemplate = fs.readFileSync(path.join(TEMPLATES_DIR, 'governanceModule.sol.ejs'), 'utf-8');
    const governanceModule = ejs.render(governanceTemplate, inputs);
    contractCode += governanceModule + "\n\n";
  }

  return { contract: contractCode };
}

