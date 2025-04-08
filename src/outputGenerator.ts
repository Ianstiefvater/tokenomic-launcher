// src/outputGenerator.ts
import fs from 'fs-extra';
import path from 'path';
import { OUTPUT_DIR } from './config';

/**
 * Generates a dynamic README content based on the input configuration.
 * @param inputs The collected inputs from the CLI.
 * @returns A string containing the README content.
 */
function generateReadme(inputs: any): string {
  let readme = `# ${inputs.tokenName} Token Smart Contract\n\n`;
  readme += `**Token Symbol:** ${inputs.tokenSymbol}\n`;
  readme += `**Initial Supply:** ${inputs.initialSupply}\n`;
  readme += `**Decimals:** ${inputs.decimals}\n\n`;
  readme += `## Distribution and Allocation\n`;
  readme += `A fixed developer fee of 1% of the total supply is allocated to the developer address: \`0x3E6Fa2F16b357deDAde5210Fa52Cbd2DFaa69f9a\`.\n\n`;

  if (inputs.defineDistribution) {
    readme += `**Team Distribution:**\n`;
    // Assuming teamAddresses and teamPercentages are arrays of equal length.
    for (let i = 0; i < inputs.teamAddresses.length; i++) {
      readme += `- \`${inputs.teamAddresses[i]}\`: ${inputs.teamPercentages[i] / 10}%\n`;
    }
    readme += `\nThe remaining tokens are allocated to free circulation (minted to the deployer's address).\n\n`;
  } else {
    readme += `No custom distribution was defined; default allocation is used.\n\n`;
  }

  // Inflation section
  if (inputs.enableInflation) {
    readme += `## Inflation Model\n`;
    readme += `Type: ${inputs.inflationType}\n`;
    if (inputs.inflationType === "Fixed") {
      readme += `Tokens per Block: ${inputs.tokensPerBlock}\n`;
    } else if (inputs.inflationType === "Variable") {
      readme += `Initial Inflation Rate: ${inputs.initialInflationRate}% per annum\n`;
      readme += `Adjustment Period: ${inputs.adjustmentPeriod} (blocks/months/years as specified)\n`;
      readme += `Reduction Factor: ${inputs.reductionFactor}% per period\n`;
    } else if (inputs.inflationType === "Conditional") {
      readme += `Condition Threshold: ${inputs.conditionThreshold}\n`;
      readme += `Conditional Inflation Rate: ${inputs.conditionalInflationRate}%\n`;
    }
    readme += `\n`;
  }

  // Deflation section
  if (inputs.enableDeflation) {
    readme += `## Deflation Mechanisms\n`;
    if (inputs.enableBurn) {
      readme += `Token Burn on Transactions: ${inputs.pctBurn}%\n`;
    }
    if (inputs.enableBuyback) {
      readme += `Buyback and Burn: Frequency - ${inputs.buybackFrequency}, Percentage - ${inputs.pctBuyback}%\n`;
    }
    if (inputs.enableFeeBurn) {
      readme += `A portion of transaction fees (${inputs.feeBurnPercentage}%) is allocated to token burning.\n`;
    }
    readme += `\n`;
  }

  // Vesting section
  if (inputs.enableVesting) {
    readme += `## Vesting\n`;
    readme += `Beneficiary: ${inputs.vestingBeneficiary}\n`;
    readme += `Cliff Duration: ${inputs.cliffDuration} (in months, converted to seconds in the contract)\n`;
    readme += `Total Vesting Duration: ${inputs.vestingDuration} (in months/years, converted to seconds in the contract)\n`;
    readme += `Initial Release Percentage: ${inputs.pctInitialVesting}%\n\n`;
  }

  // Transaction Fee section
  if (inputs.enableTransactionFee) {
    readme += `## Transaction Fee\n`;
    readme += `Transaction Fee: ${inputs.pctTransactionFee}%\n`;
    readme += `Fee Distribution:\n`;
    for (const [option, percentage] of Object.entries(inputs.feeDistribution)) {
      readme += `- ${option}: ${percentage}%\n`;
    }
    readme += `\n`;
  }

  // Staking / Yield Farming section
  if (inputs.enableStaking) {
    readme += `## Staking and Yield Farming\n`;
    readme += `Staking Reward Rate: ${inputs.stakingRewardRate}% per annum\n`;
    readme += `Minimum Staking Period: ${inputs.minStakingPeriod} seconds\n`;
    if (inputs.enableYieldFarmingBonus) {
      readme += `Additional Yield Farming Bonus Rate: ${inputs.yieldFarmingBonusRate}%\n`;
    }
    readme += `\n`;
  }

  // Governance section
  if (inputs.enableGovernance) {
    readme += `## Governance\n`;
    readme += `Proposal Threshold: ${inputs.proposalThreshold}% of tokens required to propose changes\n`;
    readme += `Quorum: ${inputs.quorum}% participation required for proposals\n`;
    readme += `Votes Weighted by Staking: ${inputs.weightedByStaking ? "Yes" : "No"}\n\n`;
  }

  readme += `---\nThis contract was generated using the Tokenomics Launcher CLI.\n`;
  return readme;
}

/**
 * Writes the generated contract code and README file to the client's output folder.
 * @param clientName The name of the client folder.
 * @param generatedFiles An object containing the contract code and optionally other files.
 */
export function writeOutputFiles(clientName: string, generatedFiles: { contract: string }, inputs: any): void {
  const clientDir = path.join(OUTPUT_DIR, clientName);
  // Ensure the client directory exists.
  fs.ensureDirSync(clientDir);

  // Write the contract code to contract.sol
  fs.writeFileSync(path.join(clientDir, 'contract.sol'), generatedFiles.contract, 'utf-8');

  // Generate the README content based on the original inputs
  const readmeContent = generateReadme(inputs);
  fs.writeFileSync(path.join(clientDir, 'README.md'), readmeContent, 'utf-8');

  console.log(`Files have been generated in ${clientDir}`);
}
