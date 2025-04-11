// src/validators.ts
import { ethers } from "ethers";

const provider = new ethers.JsonRpcProvider("http://localhost:8545");


export async function validateInputs(inputs: any): Promise<void> {
    // Print all collected inputs for review
    console.log("Collected Inputs:", inputs);
  
    // --- Basic Token Data ---
    if (!inputs.tokenName || inputs.tokenName.trim() === "") {
      throw new Error("Token name is required.");
    }
    if (!inputs.tokenSymbol || inputs.tokenSymbol.trim() === "") {
      throw new Error("Token symbol is required.");
    }
    const decimals = Number(inputs.decimals);
    if (isNaN(decimals) || decimals <= 0) {
      throw new Error("Decimals must be a positive number.");
    }
    const initialSupply = Number(inputs.initialSupply);
    if (isNaN(initialSupply) || initialSupply <= 0) {
      throw new Error("Initial supply must be a positive number.");
    }
    if (inputs.hasMaxSupply) {
      const maxSupply = Number(inputs.maxSupply);
      if (isNaN(maxSupply) || maxSupply <= 0) {
        throw new Error("Maximum supply must be a positive number.");
      }
      if (maxSupply < initialSupply) {
        throw new Error("Maximum supply must be greater than or equal to initial supply.");
      }
    }
  
    // --- Distribution and Allocation ---
    if (inputs.defineDistribution) {
      if (!Array.isArray(inputs.teamAddresses) || inputs.teamAddresses.length === 0) {
        throw new Error("Team addresses must be a non-empty array.");
      }
      if (!Array.isArray(inputs.teamPercentages) || inputs.teamPercentages.length === 0) {
        throw new Error("Team percentages must be a non-empty array.");
      }
      if (inputs.teamAddresses.length !== inputs.teamPercentages.length) {
        throw new Error("Team addresses and team percentages arrays must have the same length.");
      }
      const sumTeamPercent = inputs.teamPercentages.reduce(
        (sum: number, perc: number) => sum + perc,
        0
      );
      if (sumTeamPercent > 1000) {
        throw new Error("The sum of team percentages should not exceed 100.");
      }
    }
  
    // --- Inflation Configuration ---
    if (inputs.enableInflation) {
      if (!inputs.inflationType) {
        throw new Error("Inflation type is required when inflation is enabled.");
      }
      if (inputs.inflationType === "Fixed") {
        const tokensPerBlock = Number(inputs.tokensPerBlock);
        if (isNaN(tokensPerBlock) || tokensPerBlock < 0) {
          throw new Error("Tokens per block must be a non-negative number for Fixed inflation.");
        }
      } else if (inputs.inflationType === "Variable") {
        const initialInflationRate = Number(inputs.initialInflationRate);
        const adjustmentPeriod = Number(inputs.adjustmentPeriod);
        const reductionFactor = Number(inputs.reductionFactor);
        if (isNaN(initialInflationRate) || initialInflationRate < 0) {
          throw new Error("Initial inflation rate must be a non-negative number.");
        }
        if (isNaN(adjustmentPeriod) || adjustmentPeriod <= 0) {
          throw new Error("Adjustment period must be a positive number.");
        }
        if (isNaN(reductionFactor) || reductionFactor < 0) {
          throw new Error("Reduction factor must be a non-negative number.");
        }
      } else if (inputs.inflationType === "Conditional") {
        if (!inputs.conditionThreshold) {
          throw new Error("Condition threshold is required for Conditional inflation.");
        }
        const conditionalInflationRate = Number(inputs.conditionalInflationRate);
        if (isNaN(conditionalInflationRate) || conditionalInflationRate < 0) {
          throw new Error("Conditional inflation rate must be a non-negative number.");
        }
      }
    }
  
    // --- Deflation Configuration ---
    if (inputs.enableDeflation) {
      if (inputs.enableBurn) {
        const pctBurn = Number(inputs.pctBurn);
        if (isNaN(pctBurn) || pctBurn < 0) {
          throw new Error("Percentage for token burn must be a non-negative number.");
        }
      }
      if (inputs.enableBuyback) {
        const buybackFrequency = Number(inputs.buybackFrequency);
        const pctBuyback = Number(inputs.pctBuyback);
        if (isNaN(buybackFrequency) || buybackFrequency <= 0) {
          throw new Error("Buyback frequency must be a positive number.");
        }
        if (isNaN(pctBuyback) || pctBuyback < 0) {
          throw new Error("Buyback percentage must be a non-negative number.");
        }
      }
      if (inputs.enableFeeBurn) {
        const feeBurnPercentage = Number(inputs.feeBurnPercentage);
        if (isNaN(feeBurnPercentage) || feeBurnPercentage < 0) {
          throw new Error("Fee burn percentage must be a non-negative number.");
        }
      }
    }
  
    // --- Vesting Configuration ---
    if (inputs.enableVesting) {
      const cliffDuration = Number(inputs.cliffDuration);
      const vestingDuration = Number(inputs.vestingDuration);
      const pctInitialVesting = Number(inputs.pctInitialVesting);
      
      // Validaciones existentes:
      if (isNaN(cliffDuration) || cliffDuration <= 0) {
        throw new Error("Cliff duration must be a positive number.");
      }
      if (isNaN(vestingDuration) || vestingDuration <= 0) {
        throw new Error("Vesting duration must be a positive number.");
      }
      if (
        isNaN(pctInitialVesting) ||
        pctInitialVesting < 0 ||
        pctInitialVesting > 100
      ) {
        throw new Error("Initial vesting percentage must be between 0 and 100.");
      }
      
      // Nueva validación para vestingStart:
      let vestingStart = Number(inputs.vestingStart);
      console.log("Valor original de vestingStart:", vestingStart);
      const latestBlock = await provider.getBlock("latest");
      if (!latestBlock) {
        throw new Error("No se pudo obtener el bloque actual.");
      }
      const currentTimestamp = latestBlock.timestamp;
      
      console.log("Timestamp actual del nodo:", currentTimestamp);
      if (isNaN(vestingStart) || vestingStart < currentTimestamp) {
        vestingStart = currentTimestamp + 10000; // Suma un margen (1, por ejemplo)
      }
      // Actualizamos el input para que la plantilla reciba un valor válido.
      inputs.vestingStart = vestingStart.toString();
      console.log("Input final vestingStart:", inputs.vestingStart);
    }

  
    // --- Transaction Fee Configuration ---
    if (inputs.enableTransactionFee) {
      const pctTransactionFee = Number(inputs.pctTransactionFee);
      if (
        isNaN(pctTransactionFee) ||
        pctTransactionFee < 0 ||
        pctTransactionFee > 10000
      ) {
        throw new Error("Transaction fee percentage must be between 0 and 10000.");
      }
      if (!inputs.feeDistribution || typeof inputs.feeDistribution !== "object") {
        throw new Error("Fee distribution must be provided as an object.");
      }
      const feeDistValues = Object.values(inputs.feeDistribution);
      const sumFeeDist = feeDistValues.reduce(
        (sum: number, val: any) => sum + Number(val),
        0
      );
      if (sumFeeDist !== 100) {
        throw new Error("Fee distribution percentages must sum to 100.");
      }
    }
  
    // --- Staking and Yield Farming Configuration ---
    if (inputs.enableStaking) {
      const stakingRewardRate = Number(inputs.stakingRewardRate);
      const minStakingPeriod = Number(inputs.minStakingPeriod);
      if (isNaN(stakingRewardRate) || stakingRewardRate < 0) {
        throw new Error("Staking reward rate must be a non-negative number.");
      }
      if (isNaN(minStakingPeriod) || minStakingPeriod <= 0) {
        throw new Error("Minimum staking period must be a positive number.");
      }
      if (inputs.enableYieldFarmingBonus) {
        const yieldFarmingBonusRate = Number(inputs.yieldFarmingBonusRate);
        if (isNaN(yieldFarmingBonusRate) || yieldFarmingBonusRate < 0) {
          throw new Error("Yield farming bonus rate must be a non-negative number.");
        }
      }
    }
  
    // --- Governance Configuration ---
    if (inputs.enableGovernance) {
      // proposalThreshold y quorum vienen como strings
      let threshold: bigint;
      let quorum: bigint;

      try {
        threshold = BigInt(inputs.proposalThreshold);
      } catch {
        throw new Error("Proposal threshold must be a valid integer string.");
      }
      if (threshold < BigInt(0)) {
        throw new Error("Proposal threshold must be non‑negative.");
      }

      try {
        quorum = BigInt(inputs.quorum);
      } catch {
        throw new Error("Quorum must be a valid integer string.");
      }
      if (quorum < BigInt(0)) {
        throw new Error("Quorum must be non‑negative.");
      }

      if (typeof inputs.weightedByStaking !== "boolean") {
        throw new Error("Weighted by staking must be a boolean value.");
      }

    }



  
    console.log("All inputs validated successfully.");
  }
  