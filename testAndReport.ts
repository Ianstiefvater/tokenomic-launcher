// testAndReport.ts
import inquirer from 'inquirer';
import { execSync } from 'child_process';
import fs from 'fs';
import PDFDocument from 'pdfkit';
import path from 'path';
import hre from 'hardhat';
import puppeteer from 'puppeteer';

const ethers = (hre as any).ethers;


/**
 * Crea un contrato de prueba completo (contractTest.sol) a partir del contract.sol original,
 * reemplazando todas las ocurrencias de "internal" por "public".
 * Este archivo se usará para los tests basic, gas y security.
 */
function createFullContractTest(originalPath: string, destinationPath: string): void {
  console.log(`Creando contractTest.sol en: ${destinationPath}`);
  let code = fs.readFileSync(originalPath, 'utf8');
  // 1) Detecta y "enmascara" el `internal` de la firma de _transfer(...)

  // 1) Haz global internal → public
  code = code.replace(/\binternal\b/g, "public");

  // 2) Elimina la firma abstracta de FeeModule._transfer(...)
  //    function _transfer(...) public virtual;
  code = code.replace(
    /function\s+_feeTransfer\([^)]*\)\s+public\s+virtual;/g,
    "function _feeTransfer(address from, address to, uint256 amount) internal virtual;"
  );

  code = code.replace(
    /function\s+_feeTransfer\([^)]*\)\s+public\s+override\s*\(\s*FeeModule\s*\)\s*\{[\s\S]*?\}/g,
    `function _feeTransfer(address from, address to, uint256 amount) internal override(FeeModule) {
        ERC20._transfer(from, to, amount);
    }`
  );

  fs.writeFileSync(destinationPath, code, "utf8");
  console.log(`Created contractTest.sol`);
}
// Función que genera la cadena de argumentos del constructor a partir del JSON de entrada
function generateAllConstructorArgs(inputData: any, ownerAddress: string): Record<string, any[]> {
  const args: Record<string, any[]> = {
    basic: [inputData.teamAddresses, inputData.teamPercentages],
    security: [inputData.teamAddresses, inputData.teamPercentages],
    gas: [inputData.teamAddresses, inputData.teamPercentages],
  };

  if (inputData.enableVesting) {
    const vestingArgs = [
      inputData.vestingStart || "0",
      Number(inputData.cliffDuration),
      Number(inputData.vestingDuration),
      inputData.revocable,
      inputData.vestingBeneficiary
    ];
    console.log("vestingStart: ", inputData.vestingStart),
    
    args['basic'].push(...vestingArgs);
    args['security'].push(...vestingArgs);
    args['gas'].push(...vestingArgs);
  }

  if (inputData.enableDeflation) {
    args['basic'].push(inputData.buybackFrequency, inputData.pctBuyback);
    args['security'].push(inputData.buybackFrequency, inputData.pctBuyback);
    args['gas'].push(inputData.buybackFrequency, inputData.pctBuyback);
  }

  if (inputData.enableInflation) {
    args['basic'].push(
      inputData.tokensPerBlock || "1000",
      inputData.initialInflationRate,
      inputData.adjustmentPeriod,
      inputData.reductionFactor,
      inputData.conditionThreshold || "0",
      inputData.conditionalInflationRate || "0"
    );
    args['security'].push(
      inputData.tokensPerBlock || "1000",
      inputData.initialInflationRate,
      inputData.adjustmentPeriod,
      inputData.reductionFactor,
      inputData.conditionThreshold || "0",
      inputData.conditionalInflationRate || "0"
    );
    args['gas'].push(
      inputData.tokensPerBlock || "1000",
      inputData.initialInflationRate,
      inputData.adjustmentPeriod,
      inputData.reductionFactor,
      inputData.conditionThreshold || "0",
      inputData.conditionalInflationRate || "0"
    );
  }

  if (inputData.enableTransactionFee) {
    args['basic'].push(inputData.commissionReceiver);
    args['security'].push(inputData.commissionReceiver);
    args['gas'].push(inputData.commissionReceiver);
  }

  if (inputData.enableStaking) {
    args['basic'].push(inputData.stakingRewardRate, inputData.minStakingPeriod, ...(inputData.enableYieldFarmingBonus ? [inputData.yieldFarmingBonusRate] : []));
    args['security'].push(inputData.stakingRewardRate, inputData.minStakingPeriod, ...(inputData.enableYieldFarmingBonus ? [inputData.yieldFarmingBonusRate] : []));
    args['gas'].push(inputData.stakingRewardRate, inputData.minStakingPeriod, ...(inputData.enableYieldFarmingBonus ? [inputData.yieldFarmingBonusRate] : []));
  }

  if (inputData.enableGovernance) {
    args['basic'].push(inputData.proposalThreshold, inputData.quorum, inputData.weightedByStaking);
    args['security'].push(inputData.proposalThreshold, inputData.quorum, inputData.weightedByStaking);
    args['gas'].push(inputData.proposalThreshold, inputData.quorum, inputData.weightedByStaking);
  }

  args['vesting'] = inputData.enableVesting ? [inputData.vestingStart || "0"] : [];
  args['deflation'] = inputData.enableDeflation ? [inputData.buybackFrequency, inputData.pctBuyback] : [];
  args['inflation'] = inputData.enableInflation ? [
    inputData.tokensPerBlock || "1000",
    inputData.initialInflationRate,
    inputData.adjustmentPeriod,
    inputData.reductionFactor,
    inputData.conditionThreshold || "0",
    inputData.conditionalInflationRate || "0"
  ] : [];
  args['fee'] = inputData.enableTransactionFee ? [inputData.commissionReceiver || inputData.teamAddresses[0]] : [];
  args['staking'] = inputData.enableStaking ? [inputData.stakingRewardRate, inputData.minStakingPeriod, ...(inputData.enableYieldFarmingBonus ? [inputData.yieldFarmingBonusRate] : [])] : [];
  args['governance'] = inputData.enableGovernance ? [inputData.proposalThreshold, inputData.quorum, inputData.weightedByStaking] : [];

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
    configFileContent = configFileContent.replace(/sources:\s*['"]\.\/clients\/['"]/g, "sources: './test/'");
    fs.writeFileSync(clientHardhatConfigPath, configFileContent, 'utf8');
    console.log('Updated hardhat config file to remove client folder from sources path.');
  } catch (err) {
    console.error('Error updating hardhat config file paths:', err);
  }

  
  const testFolderPath = path.join(contractPath, 'test');
  if (!fs.existsSync(testFolderPath)) {
    fs.mkdirSync(testFolderPath, { recursive: true });
    console.log('Test folder created at:', testFolderPath);
  }
  // 3. Preguntar si se desean crear archivos de test y, de ser afirmativo, generarlos
  const createTestsAnswer = await inquirer.prompt([{ type: 'confirm', name: 'createTests', message: 'Do you want to create test files?' }]);
  if (createTestsAnswer.createTests) {   
    const src = fs.readFileSync(contractSolPath, 'utf8');
    const contractNameMatch = src.match(/contract\s+(\w+)\s+is/);
    if (!contractNameMatch) {
      console.error('Could not find contract name.');
      return;
    }
    const contractName = contractNameMatch[1];
    const inputDataPath = path.join(__dirname, 'input', 'input.json');

    if (!fs.existsSync(inputDataPath)) {
      console.error('Input data file not found.');
      return;
    }
    const inputData = JSON.parse(fs.readFileSync(inputDataPath, 'utf8'));
    const currentBlock = await ethers.provider.getBlock("latest");
    inputData.vestingStart = currentBlock.timestamp.toString();
    

    // 1. Generar el contrato completo para tests (contractTest.sol)
    const fullTestContractPath = path.join(testFolderPath, 'contractTest.sol');
    createFullContractTest(contractSolPath, fullTestContractPath);
    
    const templatesDir = path.join(__dirname, 'templates_hardhat');
    const globalTemplate = 'global.test.ts';
    const globalTemplatePath = path.join(templatesDir, globalTemplate);
    if (!fs.existsSync(globalTemplatePath)) {
      console.log(`Template ${globalTemplate} not found in ${templatesDir}.`);
      return;
    }
    let content = fs.readFileSync(globalTemplatePath, 'utf8');

    const [owner] = await ethers.getSigners(); //funcion temporal

    // Genera los argumentos para el constructor, forzando que el commissionReceiver sea owner.address
    const allArgs = generateAllConstructorArgs(inputData, owner.address); //eliminar owner.address para producción
    const moduleArgs = allArgs['basic']; // "Basic" tiene los argumentos completos del constructor
    if (moduleArgs) {
      const constructorArgs = moduleArgs.map(a => {
        if (Array.isArray(a)) {
          return JSON.stringify(a);
        } else if (typeof a === 'string') {
          // Si es una dirección (comienza con "0x") o si es uno de los tipos de inflación, envuelve entre comillas.
          if (a.startsWith('0x') || ['None', 'Fixed', 'Variable', 'Conditional'].includes(a)) {
            return `"${a}"`;
          } else {
            return a;
          }
        } else {
          return a.toString();
        }
      }).join(', ');
      content = content.replace(/token = await Token\.deploy\(\s*\/\* CONSTRUCTOR_ARGS \*\/\s*\);/, `token = await Token.deploy(${constructorArgs});`);
      console.log("Constructor arguments used:", constructorArgs);
    } else {
      content = content.replace(/token = await Token\.deploy\(\s*\/\* CONSTRUCTOR_ARGS \*\/\s*\);/, `token = await Token.deploy();`);
    }
    // Reemplazar la variable de contrato en la plantilla con "contractTest"
    content = content.replace(/__CONTRACT_NAME_TEST__/g, contractName);
    const testTemplateDestination = path.join(testFolderPath, globalTemplate);
    fs.writeFileSync(testTemplateDestination, content, 'utf8');
    console.log(`Created ${globalTemplate}`);
    
    // Compilar los contratos
    try {
      console.log('Compiling contracts with Hardhat...');
      execSync('npx hardhat compile', { cwd: contractPath });
      console.log('Contracts compiled.');
    } catch (error: any) {
      console.error('Error compiling contracts. Full output:\n');
      console.error(error.stdout.toString());
      return;
    }
  }
  
  // 5. Ejecutar tests con Mochawesome reporter, apuntando a la carpeta del cliente
  console.log('Running tests with Mochawesome reporter...');
  execSync('npx hardhat test', {
    cwd: contractPath,
    stdio: 'inherit'
  });
  console.log('Tests completed.');

  // 6. Convertir el HTML generado a PDF con Puppeteer
  console.log('Generating PDF report from HTML...');
  const htmlPath = `file://${path.resolve(
    contractPath,
    'mochawesome-report',
    'mocha-report.html'
  )}`;
  const pdfPath = path.join(contractPath, 'testReport.pdf');

  const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.goto(htmlPath, { waitUntil: 'networkidle0' });
  await page.addStyleTag({ content: `
    /* El header dentro de #report pasa a static, así no se repite en cada página */
    .navbar--component---2UCEi, .navbar--report-info-cnt---8y9Bb   {
      display: none !important;
    }
    /* Ocultamos el footer de Mochawesome */
    .footer--component---1WcTR  {
      display: none !important;
    }
    #details {
      padding-top: 0px !important;    
    }
  `});
  await page.pdf({
    path: pdfPath,
    format: 'A4',
    printBackground: true,
    margin: { top: '20mm', bottom: '20mm', left: '15mm', right: '15mm' }
  });
  await browser.close();

  console.log(`PDF report generated at: ${pdfPath}`);


}

main().catch(console.error);