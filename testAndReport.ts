// testAndReport.ts
import inquirer from 'inquirer';
import { execSync } from 'child_process';
import fs from 'fs';
import PDFDocument from 'pdfkit';
import path from 'path';

function createPublicVersionOfContract(originalPath: string, destinationPath: string): string {
    const code = fs.readFileSync(originalPath, 'utf8');
    let newCode = code.replace(/\binternal\b/g, "public");
    const match = newCode.match(/contract\s+(\w+)\s+is/);
    if (!match) throw new Error("No contract name found");
    const originalName = match[1];
    const newName = originalName + "Test";
    newCode = newCode.replace(
      new RegExp(`contract\\s+${originalName}\\s+is`),
      `contract ${newName} is`
    );
    fs.writeFileSync(destinationPath, newCode, 'utf8');
    console.log(`Contract renamed from ${originalName} to ${newName}`);
    return originalName;
  }
  

// Función que genera la cadena de argumentos del constructor a partir del JSON de entrada
function generateAllConstructorArgs(inputData: any): Record<string, any[]> {
  const args: Record<string, any[]> = {
    basic: [inputData.teamAddresses, inputData.teamPercentages],
  };

  if (inputData.enableVesting) {
    args['vesting'] = [inputData.vestingStart || "0"];
  }

  if (inputData.enableDeflation) {
    args['deflation'] = [inputData.buybackFrequency, inputData.pctBuyback];
  }

  if (inputData.enableInflation) {
    args['inflation'] = [
      inputData.tokensPerBlock || "1000",
      inputData.initialInflationRate,
      inputData.adjustmentPeriod,
      inputData.reductionFactor,
      inputData.conditionThreshold || "0",
      inputData.conditionalInflationRate || "0"
    ];
  }

  if (inputData.enableTransactionFee) {
    args['fee'] = [inputData.commissionReceiver || inputData.teamAddresses[0]];
  }

  if (inputData.enableStaking) {
    args['staking'] = [inputData.stakingRewardRate, inputData.minStakingPeriod, ...(inputData.enableYieldFarmingBonus ? [inputData.yieldFarmingBonusRate] : [])];
  }

  if (inputData.enableGovernance) {
    args['governance'] = [inputData.proposalThreshold, inputData.quorum, inputData.weightedByStaking];
  }

  args['security'] = [inputData.teamAddresses, inputData.teamPercentages];
  args['gas'] = [inputData.teamAddresses, inputData.teamPercentages];

  return args;
}
  
async function main() {
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'contractFolderName',
      message: 'Enter the path to the contract folder:',
    },
  ]);

  const contractFolderName = answers.contractFolderName;
  const contractPath = path.join('./clients', contractFolderName);
  const contractSolPath = path.join(contractPath, 'contract.sol');

  if (!fs.existsSync(contractSolPath)) {
    console.error('The contract.sol file was not found at the specified path.');
    return;
  }
  const contractTestPath = path.join(contractPath, 'contract_test.sol');
    // Crear la versión pública (copia) del contrato para testeo de funciones internas.
    createPublicVersionOfContract(contractSolPath, contractTestPath);
    const originalContractName = createPublicVersionOfContract(contractSolPath, contractTestPath);
    const publicContractName   = originalContractName + "Test";


  const clientHardhatConfigPath = path.join(contractPath, 'hardhat.config.ts');
  const globalHardhatConfigPath = path.join(__dirname, './hardhat.config.ts');
  if (!fs.existsSync(clientHardhatConfigPath)) {
    // Si no existe, copiar el archivo global a la carpeta del cliente
    try {
      fs.copyFileSync(globalHardhatConfigPath, clientHardhatConfigPath);
      console.log('The global Hardhat configuration file was copied to the client folder.');
    } catch (err) {
      console.error('Error copying hardhat.config.ts:', err);
      return;
    }
  }

  // Actualizar el archivo de configuración para eliminar la ruta "./clients/"
  try {
    let configFileContent = fs.readFileSync(clientHardhatConfigPath, 'utf8');
    // Reemplazar la ruta "./clients/" por "./" en la propiedad sources
    configFileContent = configFileContent.replace(/sources:\s*['"]\.\/clients\/['"]/g, "sources: './'");
    fs.writeFileSync(clientHardhatConfigPath, configFileContent, 'utf8');
    console.log('Updated hardhat config file to remove client folder from sources path.');
  } catch (err) {
    console.error('Error updating hardhat config file paths:', err);
  }

  // 3. Preguntar si se desean crear archivos de test y, de ser afirmativo, generarlos
  const createTestsAnswer = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'createTests',
      message: 'Do you want to create test files?',
    },
  ]);
  if (createTestsAnswer.createTests) {
    const testFolderPath = path.join(contractPath, 'test');
    if (!fs.existsSync(testFolderPath)) {
      fs.mkdirSync(testFolderPath, { recursive: true });
      console.log('Test folder created at:', testFolderPath);
    }
    
    const templatesDir = path.join(__dirname, 'templates_hardhat');

    // Leer el contrato para detectar módulos y generar plantillas condicionalmente
    const src = fs.readFileSync(contractSolPath, 'utf8');
    const has = {
      inflation: src.includes('InflationModule'),
      deflation: src.includes('DeflationModule'),
      vesting:   src.includes('TokenVesting'),
      fee:       src.includes('FeeModule'),
      staking:   src.includes('StakingModule'),
      governance:src.includes('GovernanceModule')
    };

    // Leer el archivo de input real (con los mismos parámetros usados para generar el contrato)
    const inputData = JSON.parse(fs.readFileSync(path.join(__dirname,'input','input.json'),'utf8'));
    const allArgs = generateAllConstructorArgs(inputData);

    const templates = [
      { f: 'basic.test.ts', argsKey: 'basic', cond: true },
      { f: 'inflation.test.ts', argsKey: 'inflation', cond: has.inflation },
      { f: 'deflation.test.ts', argsKey: 'deflation', cond: has.deflation },
      { f: 'vesting.test.ts', argsKey: 'vesting', cond: has.vesting },
      { f: 'fee.test.ts', argsKey: 'fee', cond: has.fee },
      { f: 'staking.test.ts', argsKey: 'staking', cond: has.staking },
      { f: 'governance.test.ts', argsKey: 'governance', cond: has.governance },
      { f: 'security.test.ts', argsKey: 'basic', cond: true },
      { f: 'gas.test.ts', argsKey: 'basic', cond: true }
    ];
  for (const tpl of templates) {
    if (tpl.cond) {
      const templatePath = path.join(templatesDir, tpl.f);
      if (!fs.existsSync(templatePath)) {
        console.log(`Template ${tpl.f} not found in ${templatesDir}.`);
        continue;
      }
      let content = fs.readFileSync(templatePath, 'utf8');

        // Obtener los argumentos específicos del módulo
      const moduleArgs = allArgs[tpl.argsKey];
      if (moduleArgs) { // Asegúrate de que moduleArgs exista
        const constructorArgs = moduleArgs
          .map(a => Array.isArray(a) ? JSON.stringify(a) : (typeof a === 'string' && a.startsWith('0x') ? `"${a}"` : a.toString()))
          .join(', ');

        content = content.replace(
          /token = await Token\.deploy\(\s*\/\* CONSTRUCTOR_ARGS \*\/\s*\);/,
          `token = await Token.deploy(${constructorArgs});`
        );
      } else {
        content = content.replace(
          /token = await Token\.deploy\(\s*\/\* CONSTRUCTOR_ARGS \*\/\s*\);/,
          `token = await Token.deploy();`
        );
      }

      content = content.replace(/__CONTRACT_NAME_TEST__/g, publicContractName);


      fs.writeFileSync(path.join(testFolderPath, tpl.f), content, 'utf8');
      console.log(`Created ${tpl.f}`);
    }
  }
  
  }
  

  let testOutput: string;
  try {
    console.log('Running tests with Hardhat...');
    // Ejecuta los tests usando la configuración de la carpeta del cliente
    testOutput = execSync(
      'npx hardhat test',
      { cwd: contractPath }
    ).toString();    
    console.log('Tests completed.');
  } catch (error: any) {
    console.error('Error running tests. Full output:\n');
    console.error(error.stdout.toString());
    return;;
  }
    // 5. Procesar la salida JSON de los tests para generar un reporte
    let structuredReport;
    try {
        structuredReport = JSON.parse(testOutput);
    } catch (err) {
        structuredReport = { raw: testOutput };
    }
  

  // 6. Generar informe PDF con los resultados estructurados de los tests
  console.log('Generating PDF report...');
  const pdfDoc = new PDFDocument();
  const pdfPath = path.join(contractPath, 'testReport.pdf');
  pdfDoc.pipe(fs.createWriteStream(pdfPath));

  pdfDoc.fontSize(16).text('Contract Test Report', { align: 'center' });
  pdfDoc.moveDown();
  pdfDoc.fontSize(12).text('Test results:');
  pdfDoc.moveDown();

  if (structuredReport.tests && Array.isArray(structuredReport.tests)) {
    structuredReport.tests.forEach((test: any) => {
      pdfDoc.fontSize(10).text(`Test: ${test.title}`);
      pdfDoc.fontSize(10).text(`Status: ${test.state}`);
      pdfDoc.moveDown();
    });
  } else {
    pdfDoc.fontSize(12).text(structuredReport.raw || '');
  }
  pdfDoc.end();
  console.log(`PDF report generated at: ${pdfPath}`);
}

main().catch(console.error);