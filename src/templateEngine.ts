import ejs from 'ejs';
import fs from 'fs';
import path from 'path';
import { TEMPLATES_DIR } from './config';

export function renderTemplates(inputs: any): { contract: string } {
  // 1) Header
  const header = fs.readFileSync(
    path.join(TEMPLATES_DIR, 'baseERC20Header.sol.ejs'),
    'utf-8'
  );
  let code = ejs.render(header, inputs) + '\n\n';

  // 2) Modules
  const modules = [
    ['enableVesting', 'vestingModule.sol.ejs'],
    ['enableDeflation', 'deflationModule.sol.ejs'],
    ['enableInflation', 'inflationModule.sol.ejs'],
    ['enableTransactionFee', 'feeModule.sol.ejs'],
    ['enableStaking', 'stakingModule.sol.ejs'],
    ['enableGovernance', 'governanceModule.sol.ejs'],
  ];
  for (const [flag, filename] of modules) {
    if ((inputs as any)[flag]) {
      const tpl = fs.readFileSync(path.join(TEMPLATES_DIR, filename), 'utf-8');
      code += ejs.render(tpl, inputs) + '\n\n';
    }
  }

  // 3) Concrete contract
  const finalTpl = fs.readFileSync(
    path.join(TEMPLATES_DIR, 'baseERC20.sol.ejs'),
    'utf-8'
  );
  code += ejs.render(finalTpl, inputs);

  return { contract: code };
}

