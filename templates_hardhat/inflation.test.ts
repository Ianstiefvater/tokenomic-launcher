import { expect } from "chai";
import { ethers } from "hardhat";

describe("Inflation Module Tests", function () {
  let token: any;
  let currentBlock: number;
  let inflationType: number;

  before(async function () {
    const Token = await ethers.getContractFactory("__CONTRACT_NAME_TEST__");
    token = await Token.deploy(/* CONSTRUCTOR_ARGS */);
    currentBlock = await ethers.provider.getBlockNumber();
    inflationType = (await token.inflationType()) as number; // 0=None,1=Fixed,2=Variable,3=Conditional
  });

  it("Should calculate fixed inflation correctly", async function () {
    if (inflationType !== 1) {
      this.skip();
    }
    const tokensPerBlock = await token.tokensPerBlock();
    const inflation = await token._calculateInflation(currentBlock);
    expect(inflation.toString()).to.equal(tokensPerBlock.toString());
  });

  it("Should calculate variable inflation correctly", async function () {
    if (inflationType !== 2) {
      this.skip();
    }
    const adjustmentPeriod = await token.adjustmentPeriod();
    const initialInflationRate = await token.initialInflationRate();
    const reductionFactor = await token.reductionFactor();
    
    const periods = Math.floor(currentBlock / Number(adjustmentPeriod));
    let currentRate = Number(initialInflationRate);
    if (periods > 0) {
      const reduction = periods * Number(reductionFactor);
      currentRate = reduction >= Number(initialInflationRate)
        ? 0
        : Number(initialInflationRate) - reduction;
    }
    const expectedInflation = BigInt(Math.floor((1e18 * currentRate) / 100));
    
    const inflation = await token._calculateInflation(currentBlock);
    expect(inflation.toString()).to.equal(expectedInflation.toString());
  });

  it("Should calculate conditional inflation correctly", async function () {
    if (inflationType !== 3) {
      this.skip();
    }
    const conditionalInflationRate = await token.conditionalInflationRate();
    const expectedInflation = BigInt(Math.floor((1e18 * Number(conditionalInflationRate)) / 100));
    
    const inflation = await token._calculateInflation(currentBlock);
    expect(inflation.toString()).to.equal(expectedInflation.toString());
  });
});

