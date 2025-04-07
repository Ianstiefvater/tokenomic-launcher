// src/inputHandler.ts
import inquirer from 'inquirer';
import fs from 'fs';
import path from 'path';

export async function getUserInputs(): Promise<any> {
  // Ask whether to import from a JSON file or enter inputs manually
  const { inputMode } = await inquirer.prompt([
    {
      type: 'list',
      name: 'inputMode',
      message: 'How would you like to provide your inputs?',
      choices: [
        { name: 'Manually (via prompts)', value: 'manual' },
        { name: 'Import from JSON file', value: 'json' }
      ]
    }
  ]);

  if (inputMode === 'json') {
    const { jsonFileName } = await inquirer.prompt([
      {
        type: 'input',
        name: 'jsonFileName',
        message: 'Enter the JSON filename (without extension) located in the ./input directory:',
      }
    ]);

    const filePath = path.join(__dirname, '../input', `${jsonFileName}.json`);
    try {
      const fileData = fs.readFileSync(filePath, 'utf-8');
      const parsedData = JSON.parse(fileData);
      console.log("\nLoaded JSON inputs:");
      console.log(JSON.stringify(parsedData, null, 2));
      return parsedData;
    } catch (error) {
      console.error("Error reading or parsing the JSON file:", error);
      process.exit(1);
    }
  }

  // Otherwise, collect inputs manually via prompts

  // Basic token data
  const basicAnswers = await inquirer.prompt([
    {
      type: 'input',
      name: 'tokenName',
      message: 'What is the token name?',
    },
    {
      type: 'input',
      name: 'tokenSymbol',
      message: 'What is the token symbol?',
    },
    {
      type: 'input',
      name: 'decimals',
      message: 'How many decimals will the token have?',
      default: '18',
      validate: (input: string) =>
        !isNaN(Number(input)) && Number(input) > 0
          ? true
          : 'Please enter a positive number.',
    },
    {
      type: 'input',
      name: 'initialSupply',
      message: 'What is the initial supply for distribution?',
      validate: (input: string) =>
        !isNaN(Number(input)) && Number(input) > 0
          ? true
          : 'Please enter a positive number.',
    },
    {
      type: 'confirm',
      name: 'hasMaxSupply',
      message: 'Is there a maximum supply of tokens?',
      default: false,
    },
    {
      type: 'input',
      name: 'maxSupply',
      message: 'What is the maximum supply?',
      when: (answers) => answers.hasMaxSupply,
      validate: (input: string) =>
        !isNaN(Number(input)) && Number(input) > 0
          ? true
          : 'Please enter a positive number.',
    },
    {
      type: 'input',
      name: 'clientName',
      message: 'Enter a client name for the output folder (default: token name):',
      default: (answers) => answers.tokenName,
    }
  ]);

  // Distribution and Allocation configuration
  const distributionAnswers = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'defineDistribution',
      message: 'Do you want to define an initial percentage distribution for token allocation?',
      default: true,
    },
    {
      type: 'input',
      name: 'teamPercentages',
      message:
        'Enter the team allocation percentages as comma-separated values (e.g., 50,30,20):',
      when: (answers) => answers.defineDistribution,
      filter: (input: string) => input.split(',').map((str) => Number(str.trim())),
    },
    {
      type: 'input',
      name: 'teamAddresses',
      message:
        'Enter the corresponding team addresses as comma-separated values:',
      when: (answers) => answers.defineDistribution,
      filter: (input: string) => input.split(',').map((str) => str.trim()),
    }
  ]);

  // Inflation configuration
  const inflationAnswers = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'enableInflation',
      message: 'Do you want the token to have an inflation model?',
      default: false,
    },
    {
      type: 'list',
      name: 'inflationType',
      message: 'Which type of inflation do you want to implement?',
      choices: ['Fixed', 'Variable', 'Conditional'],
      when: (answers) => answers.enableInflation,
    },
    {
      type: 'input',
      name: 'tokensPerBlock',
      message:
        'For Fixed Inflation: How many tokens will be minted per period or block?',
      when: (answers) =>
        answers.enableInflation && answers.inflationType === 'Fixed',
      validate: (input: string) =>
        !isNaN(Number(input)) && Number(input) >= 0
          ? true
          : 'Please enter a non-negative number.',
    },
    {
      type: 'input',
      name: 'initialInflationRate',
      message:
        'For Variable Inflation: What is the initial inflation rate (% per annum)?',
      when: (answers) =>
        answers.enableInflation && answers.inflationType === 'Variable',
      validate: (input: string) =>
        !isNaN(Number(input)) && Number(input) >= 0
          ? true
          : 'Please enter a non-negative number.',
    },
    {
      type: 'input',
      name: 'adjustmentPeriod',
      message:
        'For Variable Inflation: How often is the rate adjusted? (enter number of blocks, months, or years)',
      when: (answers) =>
        answers.enableInflation && answers.inflationType === 'Variable',
      validate: (input: string) =>
        !isNaN(Number(input)) && Number(input) > 0
          ? true
          : 'Please enter a positive number.',
    },
    {
      type: 'input',
      name: 'reductionFactor',
      message:
        'For Variable Inflation: What is the reduction factor (% reduction per period)?',
      when: (answers) =>
        answers.enableInflation && answers.inflationType === 'Variable',
      validate: (input: string) =>
        !isNaN(Number(input)) && Number(input) >= 0
          ? true
          : 'Please enter a non-negative number.',
    },
    {
      type: 'input',
      name: 'conditionThreshold',
      message:
        'For Conditional Inflation: What is the threshold/condition to trigger additional inflation?',
      when: (answers) =>
        answers.enableInflation && answers.inflationType === 'Conditional',
      validate: (input: string) => (input ? true : 'Please provide a value.'),
    },
    {
      type: 'input',
      name: 'conditionalInflationRate',
      message:
        'For Conditional Inflation: What is the inflation rate (%) when the condition is met?',
      when: (answers) =>
        answers.enableInflation && answers.inflationType === 'Conditional',
      validate: (input: string) =>
        !isNaN(Number(input)) && Number(input) >= 0
          ? true
          : 'Please enter a non-negative number.',
    }
  ]);

  // Deflation configuration
  const deflationAnswers = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'enableDeflation',
      message: 'Do you want to implement deflationary mechanisms?',
      default: false,
    },
    {
      type: 'confirm',
      name: 'enableBurn',
      message: 'Do you want to enable token burning on each transaction?',
      when: (answers) => answers.enableDeflation,
      default: false,
    },
    {
      type: 'input',
      name: 'pctBurn',
      message: 'What percentage of each transaction will be burned?',
      when: (answers) => answers.enableDeflation && answers.enableBurn,
      validate: (input: string) =>
        !isNaN(Number(input)) && Number(input) >= 0
          ? true
          : 'Please enter a valid percentage.',
    },
    {
      type: 'confirm',
      name: 'enableBuyback',
      message: 'Do you want to implement a buyback and burn mechanism?',
      when: (answers) => answers.enableDeflation,
      default: false,
    },
    {
      type: 'input',
      name: 'buybackFrequency',
      message:
        'For Buyback: How often will buybacks occur? (e.g., monthly, quarterly)',
      when: (answers) => answers.enableDeflation && answers.enableBuyback,
      validate: (input: string) =>
        input ? true : 'Please enter a valid frequency.',
    },
    {
      type: 'input',
      name: 'pctBuyback',
      message:
        'For Buyback: What percentage of earnings or funds will be allocated to buybacks?',
      when: (answers) => answers.enableDeflation && answers.enableBuyback,
      validate: (input: string) =>
        !isNaN(Number(input)) && Number(input) >= 0
          ? true
          : 'Please enter a valid percentage.',
    },
    {
      type: 'confirm',
      name: 'enableFeeBurn',
      message:
        'Do you want a portion of transaction fees to be allocated to burning?',
      when: (answers) => answers.enableDeflation,
      default: false,
    },
    {
      type: 'input',
      name: 'feeBurnPercentage',
      message:
        'What percentage of transaction fees will be burned?',
      when: (answers) => answers.enableDeflation && answers.enableFeeBurn,
      validate: (input: string) =>
        !isNaN(Number(input)) && Number(input) >= 0
          ? true
          : 'Please enter a valid percentage.',
    }
  ]);

  // Vesting configuration
  const vestingAnswers = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'enableVesting',
      message: 'Do you want to include a vesting mechanism for team/advisors?',
      default: false,
    },
    {
      type: 'input',
      name: 'cliffDuration',
      message: 'What is the cliff period (in months)?',
      when: (answers) => answers.enableVesting,
      validate: (input: string) =>
        !isNaN(Number(input)) && Number(input) > 0
          ? true
          : 'Please enter a positive number.',
    },
    {
      type: 'confirm',
      name: 'revocable',
      message: 'Should the vesting be revocable?',
      when: (answers) => answers.enableVesting,
      default: false,
    },
    {
      type: 'input',
      name: 'vestingBeneficiary',
      message: 'Enter the vesting beneficiary address:',
      when: (answers) => answers.enableVesting,
      validate: (input: string) =>
        input.trim().length > 0 ? true : 'Please enter a valid address.'
    },  
    {
      type: 'input',
      name: 'vestingDuration',
      message: 'What is the total vesting duration (in months or years)?',
      when: (answers) => answers.enableVesting,
      validate: (input: string) =>
        !isNaN(Number(input)) && Number(input) > 0
          ? true
          : 'Please enter a positive number.',
    },
    {
      type: 'input',
      name: 'pctInitialVesting',
      message: 'What percentage is released initially?',
      when: (answers) => answers.enableVesting,
      validate: (input: string) =>
        !isNaN(Number(input)) && Number(input) >= 0
          ? true
          : 'Please enter a valid percentage.',
    }
  ]);

  // Transaction Fee configuration
  const feeConfigAnswers = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'enableTransactionFee',
      message: 'Do you want to apply a transaction fee?',
      default: false,
    },
    {
      type: 'input',
      name: 'pctTransactionFee',
      message: 'What percentage of each transaction will be charged as fee?',
      when: (answers) => answers.enableTransactionFee,
      validate: (input: string) =>
        !isNaN(Number(input)) && Number(input) >= 0
          ? true
          : 'Please enter a valid percentage.',
    },
    {
      type: 'input',
      name: 'feeDistribution',
      message:
        'How will this fee be distributed? Enter as comma-separated values in the format Option:Percentage (e.g., Burning:30,Rewards:40,DevFund:30)',
      when: (answers) => answers.enableTransactionFee,
      filter: (input: string) => {
        const parts = input.split(',').map(pair => pair.split(':').map(s => s.trim()));
        const result: { [key: string]: number } = {};
        parts.forEach(([key, value]) => {
          result[key] = Number(value);
        });
        return result;
      }
    }
  ]);

  // Staking and Yield Farming configuration
  const stakingAnswers = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'enableStaking',
      message: 'Does the token have staking/yield farming functions?',
      default: false,
    },
    {
      type: 'input',
      name: 'stakingRewardRate',
      message: 'What is the annual staking reward rate (in %)?',
      when: (answers) => answers.enableStaking,
      validate: (input: string) =>
        !isNaN(Number(input)) && Number(input) >= 0
          ? true
          : 'Please enter a valid percentage.',
    },
    {
      type: 'input',
      name: 'minStakingPeriod',
      message: 'What is the minimum staking period (in seconds)?',
      when: (answers) => answers.enableStaking,
      validate: (input: string) =>
        !isNaN(Number(input)) && Number(input) > 0
          ? true
          : 'Please enter a positive number.',
    },
    {
      type: 'confirm',
      name: 'enableYieldFarmingBonus',
      message: 'Do you want to add an additional yield farming incentive?',
      when: (answers) => answers.enableStaking,
      default: false,
    },
    {
      type: 'input',
      name: 'yieldFarmingBonusRate',
      message: 'What is the additional yield farming bonus rate (in %)?',
      when: (answers) => answers.enableStaking && answers.enableYieldFarmingBonus,
      validate: (input: string) =>
        !isNaN(Number(input)) && Number(input) >= 0
          ? true
          : 'Please enter a valid percentage.',
    }
  ]);

  // Governance configuration
  const governanceAnswers = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'enableGovernance',
      message: 'Do you want the token to include governance mechanisms?',
      default: false,
    },
    {
      type: 'input',
      name: 'proposalThreshold',
      message:
        'What is the minimum percentage of tokens required to propose changes?',
      when: (answers) => answers.enableGovernance,
      validate: (input: string) =>
        !isNaN(Number(input)) && Number(input) >= 0
          ? true
          : 'Please enter a valid percentage.',
    },
    {
      type: 'input',
      name: 'quorum',
      message:
        'What is the quorum required for proposal approval (in %)?',
      when: (answers) => answers.enableGovernance,
      validate: (input: string) =>
        !isNaN(Number(input)) && Number(input) >= 0
          ? true
          : 'Please enter a valid percentage.',
    },
    {
      type: 'confirm',
      name: 'weightedByStaking',
      message:
        'Should governance tokens be weighted by staking duration?',
      when: (answers) => answers.enableGovernance,
      default: false,
    }
  ]);

  // Merge all answers
  let mergedAnswers = {
    ...basicAnswers,
    ...distributionAnswers,
    ...inflationAnswers,
    ...deflationAnswers,
    ...vestingAnswers,
    ...feeConfigAnswers,
    ...stakingAnswers,
    ...governanceAnswers,
  };

  // Review and edit function: allow user to go back and change answers
  mergedAnswers = await reviewAndEditAnswers(mergedAnswers);

  return mergedAnswers;
}

/**
 * Allows the user to review and edit the collected answers.
 * The user can type a key to edit that particular answer, or "continue" to finish.
 * @param answers The collected answers object.
 * @returns The final answers object after potential edits.
 */
async function reviewAndEditAnswers(answers: any): Promise<any> {
  console.log("\n--- Review Your Answers ---");
  console.log(JSON.stringify(answers, null, 2));

  while (true) {
    const { editKey } = await inquirer.prompt([
      {
        type: 'input',
        name: 'editKey',
        message: "Enter the key of the answer you want to change (or type 'continue' to finish):",
      },
    ]);

    if (editKey.toLowerCase() === 'continue') {
      break;
    }

    if (answers.hasOwnProperty(editKey)) {
      const { newValue } = await inquirer.prompt([
        {
          type: 'input',
          name: 'newValue',
          message: `Enter new value for ${editKey}:`,
          default: answers[editKey]
        }
      ]);
      // Convert to number if applicable
      if (!isNaN(Number(newValue))) {
        answers[editKey] = Number(newValue);
      } else {
        answers[editKey] = newValue;
      }
      console.log("Updated Answers:");
      console.log(JSON.stringify(answers, null, 2));
    } else {
      console.log(`Key '${editKey}' not found in your answers. Please try again.`);
    }
  }

  return answers;
}
