import { expect } from "chai";
import { ethers } from "hardhat";
import { parseEther } from "ethers";
const { BigNumber } = require("ethers");
const inputData = require("../../../input/input.json");

describe("Global Token Tests", function () {
  let token: any;
  let owner: any, addr1: any, addr2: any, others: any[];
  let initialTotalSupply: bigint;
  let initialSnapshot: string;

  before(async function () {
    [owner, addr1, addr2, ...others] = await ethers.getSigners();
    const Token = await ethers.getContractFactory("__CONTRACT_NAME_TEST__");
    try {
      token = await Token.deploy(/* CONSTRUCTOR_ARGS */);
      console.log("Deployment initiated. Waiting for deployment...");
      await token.waitForDeployment();
      console.log("Deployed token features:", token);
    } catch (e) {
      console.error("Error during deployment:", e);
    }
    
    

    if (inputData.enableTransactionFee) {
      await owner.sendTransaction({
        to: token.target,
        value: parseEther("3")
      });
    }
    initialTotalSupply = await token.totalSupply();
    initialSnapshot = await ethers.provider.send("evm_snapshot", []);    
  });

  // ---------- Basic Token Tests ----------
  describe("Basic Token Tests", function () {
    it("Should have the correct name, symbol and decimals", async function () {
      expect(await token.name()).to.equal(inputData.tokenName);
      expect(await token.symbol()).to.equal(inputData.tokenSymbol);
      expect(await token.decimals()).to.equal(Number(inputData.decimals));
    });

    it("Should assign the initial supply correctly", async function () {
      const totalSupply = await token.totalSupply();
      expect(totalSupply).to.be.gt(0);
    });

    it("Should transfer tokens correctly", async function () {
      const initialBalance = await token.balanceOf(addr1.address);
      const transferAmount = parseEther("100");
      const devFee = await token._calculateDeveloperFee(transferAmount);

      await token.transfer(addr1.address, transferAmount);
      const finalBalance = await token.balanceOf(addr1.address);
      expect(finalBalance - initialBalance).to.equal(transferAmount - devFee);
    });

    it("Should approve and set allowance correctly", async function () {
      await token.approve(addr2.address, parseEther("50"));
      const allowance = await token.allowance(owner.address, addr2.address);
      expect(allowance).to.equal(parseEther("50"));
    }); 
  });
  // ---------- Distribution Tests ----------
  describe("Team Allocation Tests", function () {
    before(function () {
      if (!inputData.defineDistribution) this.skip();
    });

    it("Should mint correct team allocations", async function () {
      const teamAddresses   = inputData.teamAddresses as string[];
      const teamPercentages = inputData.teamPercentages as number[];

      for (let i = 0; i < teamAddresses.length; i++) {
        const expected = initialTotalSupply * BigInt(teamPercentages[i]) / BigInt(1000);
        const actual   = await token.balanceOf(teamAddresses[i]);
        expect(actual).to.equal(expected);
      }
    });
  });

// ---------- Fee Module Tests ----------
describe("Fee Module Tests", function () {
  before(async function () {
    if (!inputData.enableTransactionFee) this.skip();
    await token.transfer(addr1.address, parseEther("100"));

  });

  it("Should calculate and process developer fee correctly", async function () {
    const transferAmount = parseEther("100"); 
    const devFee         = await token._calculateDeveloperFee(transferAmount);
    const expectedDevFee = (transferAmount * BigInt(10)) / BigInt(10000); 

    expect(devFee).to.equal(expectedDevFee);
  });

  it("Should transfer developer fee on transfer", async function () {
    const commission = await token.commissionReceiver();
    const beforeBal  = await token.balanceOf(commission);

    const transferAmount = parseEther("100");
    await token.connect(addr1).transfer(addr2.address, transferAmount);

    const devFee = await token._calculateDeveloperFee(transferAmount);
    const afterBal = await token.balanceOf(commission);

    expect(afterBal - beforeBal).to.equal(devFee);
  });
});



  // ---------- Security Tests ----------
  describe("Security Tests", function () {
    it("Should revert on arithmetic overflow/underflow", async function () {
      const max = BigInt(2) ** BigInt(256) - BigInt(1);
      await expect(token.transfer(addr1.address, max)).to.be.reverted;
      await token.approve(addr2.address, parseEther("1"));
      await expect(
        token.connect(addr2).transferFrom(owner.address, addr1.address, max)
      ).to.be.reverted;
    });

    it("Should resist DoS by many proposals in governance", async function () {
      if (!inputData.enableGovernance) {
        this.skip(); 
      }
      const threshold = await token.proposalThreshold();
      await token.transfer(owner.address, threshold);
      for (let i = 0; i < 200; i++) {
        await token.createProposal(`desc${i}`, 60);
      }
    });

    it("Should be safe against front-running in transfer fees", async function () {
      const amt = parseEther("10");
      const fee1 = await token._calculateTotalFee(amt);
      await token.transfer(addr1.address, amt);
      const fee2 = await token._calculateTotalFee(amt);
      expect(fee1.toString()).to.equal(fee2.toString());
    });
  });
  

  // ---------- Gas Consumption Tests ----------
  describe("Gas Consumption Tests", function () {
    it("Should measure gas consumption for transfers", async function () {
      const tx = await token.transfer(addr1.address, parseEther("10"));
      const receipt = await tx.wait();
      console.log("Gas used for transfer:", receipt.gasUsed.toString());
      expect(receipt.gasUsed).to.be.gt(BigInt(0));
    });
  });
  

  // ---------- Governance Module Tests ----------
  describe("Governance Module Tests", function () {
    const description = "Test proposal";
    const duration = 60 * 60; 

    before(function () {
      if (!inputData.enableGovernance) {
        this.skip();
      }
    });

    beforeEach(async function () {

      await ethers.provider.send("evm_revert", [initialSnapshot]);

      initialSnapshot = await ethers.provider.send("evm_snapshot", []);
  
      const threshold = await token.proposalThreshold();
      await token.transfer(owner.address, threshold);
      await token.createProposal(description, duration);
    });

    it("Should create a proposal when threshold met and store it correctly", async function () {;
      
      await ethers.provider.send("evm_revert", [initialSnapshot]);
      initialSnapshot = await ethers.provider.send("evm_snapshot", []);
      const threshold = await token.proposalThreshold();
      await token.transfer(owner.address, threshold);
      await token.createProposal(description, duration);
      
      const p = await token.proposals(1);
      expect(p.id).to.equal(BigInt(1));
      expect(p.proposer).to.equal(owner.address);
      expect(p.description).to.equal(description);
      expect(p.voteFor).to.equal(BigInt(0));
      expect(p.voteAgainst).to.equal(BigInt(0));
      expect(p.executed).to.equal(false);
    });

    it("Should allow voting and emit Voted, updating counts", async function () {
      await ethers.provider.send("evm_revert", [initialSnapshot]);
      initialSnapshot = await ethers.provider.send("evm_snapshot", []);
      const threshold = await token.proposalThreshold();
      await token.transfer(owner.address, threshold);
      await token.createProposal(description, duration);

      await token.vote(1, true, BigInt(1));
      await token.transfer(addr2.address, parseEther("1"));
      await token.connect(addr2).vote(1, false, BigInt(1));
      const p = await token.proposals(1);
      expect(p.voteFor).to.equal(BigInt(1));
      expect(p.voteAgainst).to.equal(BigInt(1));

    });

    it("Should not allow double voting", async function () {
      await token.vote(1, true, 1);
      await expect(token.vote(1, true, 1))
        .to.be.revertedWith("You have already voted on this proposal");
    });

    it("Should not allow execution before deadline or without quorum", async function () {
      await expect(token.executeProposal(1))
      .to.be.revertedWith("Voting is not yet complete");

      await ethers.provider.send("evm_increaseTime", [duration + 1]);
      await ethers.provider.send("evm_mine", []);

      const p2 = await token.proposals(1);
      const totalVotes = p2.voteFor + p2.voteAgainst;
      const quorum = await token.quorum();
      if (totalVotes < quorum) {
        await expect(token.executeProposal(1))
            .to.be.revertedWith("The required quorum was not reached");
      }
    });

    it("Should execute proposal when conditions met and emit ProposalExecuted", async function () {
      const quorumBN = await token.quorum();    
      const p3 = await token.proposals(1);
      const totalVotes = p3.voteFor + p3.voteAgainst;
  
      if (totalVotes < quorumBN) {
        const needed = quorumBN - totalVotes;
        await token.transfer(owner.address, needed);
        await token.vote(1, true, needed);
      }
  

      await ethers.provider.send("evm_increaseTime", [duration + 1]);
      await ethers.provider.send("evm_mine", []);
  
      const tx = await token.executeProposal(1);
      const receipt = await tx.wait();

      const pAfter = await token.proposals(1);
      expect(pAfter.executed).to.equal(true);

      if (receipt.events) {
        const evExec = receipt.events.find((e: any) => e.event === "ProposalExecuted");
        expect(evExec, "No ProposalExecuted event").to.exist;
        const [id, approved] = evExec.args;
        expect(id.toNumber()).to.equal(1);
        expect(approved).to.equal(pAfter.voteFor.gt(pAfter.voteAgainst));
      }
    });
  });

    // ---------- Deflation Module Tests ----------
    describe("Deflation Module Tests", function () {
      before(function () {
        if (!inputData.enableDeflation) {
          this.skip();
        }
      });
  
      it("Should reduce the contract's token balance via buyback and burn", async function () {
        const contractAddress = token.target;
        console.log("Using token.target:", contractAddress);
        const transferAmount = parseEther("100");
        await token.transfer(contractAddress, transferAmount);
        const balanceBefore = await token.balanceOf(contractAddress);
        await token.executeBuybackAndBurn();
        const balanceAfter = await token.balanceOf(contractAddress);
        expect(balanceAfter).to.be.lt(balanceBefore);
      });
  
      it("Should decrease the total supply after buyback and burn", async function () {
        const totalSupplyBefore = await token.totalSupply();
        const contractAddress = token.target;
        const transferAmount = parseEther("50");
        await token.transfer(contractAddress, transferAmount);
        await token.executeBuybackAndBurn();
        const totalSupplyAfter = await token.totalSupply();
        expect(totalSupplyAfter).to.be.lt(totalSupplyBefore);
      });
    });

    

  // ---------- Inflation Module Tests ----------
  describe("Inflation Module Tests", function () {
    before(function () {
      if (!inputData.enableInflation) {
        this.skip();
      }
    });

    let currentBlock: number, inflationType: string;
    const inflationTypeMap: Record<string, string> = {
      "0": "None",
      "1": "Fixed",
      "2": "Variable",
      "3": "Conditional"
    };

    before(async function () {
      currentBlock = await ethers.provider.getBlockNumber();
      const inflationTypeValue = (await token.inflationType()).toString();
      inflationType = inflationTypeMap[inflationTypeValue];
    });

    it("Should calculate fixed inflation correctly", async function () {
      if (inflationType !== "Fixed") {
        this.skip();
      }
      const tokensPerBlock = await token.tokensPerBlock();
      const inflation = await token._calculateInflation(currentBlock);
      expect(inflation.toString()).to.equal(tokensPerBlock.toString());
    });

    it("Should calculate variable inflation correctly", async function () {
      if (inflationType !== "Variable") {
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
      if (inflationType !== "Conditional") {
        this.skip();
      }
      const conditionalInflationRate = await token.conditionalInflationRate();
      const expectedInflation = BigInt(Math.floor((1e18 * Number(conditionalInflationRate)) / 100));
      const inflation = await token._calculateInflation(currentBlock);
      expect(inflation.toString()).to.equal(expectedInflation.toString());
    });
  });

  // ---------- Staking Module Tests ----------
  describe("Staking Module Tests", function () {
    const stakeAmount = parseEther("10");
    let minStakingPeriod: number, stakingRewardRate: number, yieldFarmingBonusRate: number;
    before(function () {
      if (!inputData.enableStaking) {
        this.skip();
      }
    });
    beforeEach(async function () {
      await ethers.provider.send("evm_revert", [initialSnapshot]);
      initialSnapshot = await ethers.provider.send("evm_snapshot", []);
    
      await token.transfer(addr1.address, stakeAmount);
      await token.connect(addr1).approve(token.target, stakeAmount);
      await token.connect(addr1).stake(stakeAmount);
    
      const reward = await token.calculateReward(addr1.address);
      const toDeposit = stakeAmount + reward;
      await token.transfer(token.target, toDeposit);
    });
    

    before(async function () {
      minStakingPeriod = Number((await token.minStakingPeriod()).toString());
      stakingRewardRate = Number((await token.stakingRewardRate()).toString());
      yieldFarmingBonusRate = Number((await token.yieldFarmingBonusRate()).toString());
    });

    it("Should allow staking correctly and emit Staked event", async function () {
      const stakeData = await token.stakes(addr1.address);
      expect(stakeData.amount.toString()).to.equal(stakeAmount.toString());
      expect(Number(stakeData.startTime)).to.be.gt(0);
    });

    it("Should calculate reward correctly after time increase", async function () {
      await ethers.provider.send("evm_increaseTime", [minStakingPeriod + 1]);
      await ethers.provider.send("evm_mine", []);
      const stakeData = await token.stakes(addr1.address);
      const block = await ethers.provider.getBlock("latest");
      if (!block) throw new Error("Failed to fetch latest block");
      const stakingDuration = block.timestamp - Number(stakeData.startTime);
      const totalRate = stakingRewardRate + yieldFarmingBonusRate;
      const expectedReward = (BigInt(stakeData.amount.toString()) * BigInt(totalRate) * BigInt(stakingDuration)) / (BigInt(365 * 24 * 3600) * BigInt(100));
      const reward = await token.calculateReward(addr1.address);
      expect(reward.toString()).to.equal(expectedReward.toString());
    });

    it("Should allow unstaking correctly and reset stake", async function () {
      const extraBuffer = ethers.parseEther("0.01"); 
      await token.transfer(token.target, extraBuffer);
      await ethers.provider.send("evm_increaseTime", [minStakingPeriod + 1]);
      await ethers.provider.send("evm_mine", []);
      await token.connect(addr1).unstake();
      const after = await token.stakes(addr1.address);
      expect(after.amount.toString()).to.equal("0");
      expect(after.startTime.toString()).to.equal("0");
    });   
  });

  // ---------- Vesting Module Tests ----------
  describe("Vesting Module Tests", function () {
    before(function () {
      if (!inputData.enableVesting) {
        this.skip();
      }
    });

    const totalBalance = parseEther("1000");
    let vestingSnapshot: string;
    let cliffDuration: number;
    let vestingDuration: number;

    before(async function () {
      await ethers.provider.send("evm_revert", [initialSnapshot]);

      await token.transfer(token.target, totalBalance);  


      vestingSnapshot = await ethers.provider.send("evm_snapshot", []);

      cliffDuration   = Number(inputData.cliffDuration);
      vestingDuration = Number(inputData.vestingDuration);


    });

    beforeEach(async function () {
      await ethers.provider.send("evm_revert", [vestingSnapshot]);
    });

    it("Should report zero vested and releasable before cliff", async function () {
      const last = await ethers.provider.getBlock("latest");
      const start = Number(await token.start());
      
      if (!last) {
        throw new Error("No se pudo obtener el último bloque");
      }
      const baseOffset = last.timestamp - start;

      const desiredOffset = cliffDuration - 1;
      const nextTs = last.timestamp + (desiredOffset - baseOffset);
      await ethers.provider.send("evm_setNextBlockTimestamp", [nextTs]);
      await ethers.provider.send("evm_mine", []);


      const vested = await token.vestedAmount(totalBalance);
      const releasable = await token.releasableAmount(totalBalance);
      expect(vested.toString()).to.equal("0");
      expect(releasable.toString()).to.equal("0");
    });

    it("Should vest proportionally during vesting period", async function () {
      const start   = Number(await token.start());
      const cliff   = Number(await token.cliff());
      const vestDur = Number(await token.vestingDuration());
    

      const end = start + vestDur;
      const targetTs = cliff + Math.floor((end - cliff) / 2);
    
    
      await ethers.provider.send("evm_setNextBlockTimestamp", [targetTs]);
      await ethers.provider.send("evm_mine", []);

      const blockAfter = await ethers.provider.getBlock("latest");
      if (!blockAfter) {
        throw new Error("No se pudo obtener el último bloque");
      }
    
      const vested  = await token.vestedAmount(totalBalance);
      console.log("vested:", vested.toString());
    
      const elapsed  = blockAfter.timestamp - start;
    
      // expected = totalBalance * (timestamp - start) / vestDur
      const expected = BigInt(totalBalance.toString()) * BigInt(elapsed) / BigInt(vestDur);
    
      expect(vested.toString()).to.equal(expected.toString());
    });
    
    it("Should revoke vesting if revocable", async function () {
      const revocable = await token.revocable();
      if (revocable) {
        const last = await ethers.provider.getBlock("latest");
        if (!last) {
          throw new Error("No se pudo obtener el último bloque");
        }
        // Avanzamos el tiempo hasta el final del vesting
        await ethers.provider.send("evm_setNextBlockTimestamp", [last.timestamp + vestingDuration]);
        await ethers.provider.send("evm_mine", []);
  
        // Ahora pasamos el totalBalance a revoke
        await token.revoke(totalBalance);
        const vested = await token.vestedAmount(totalBalance);
        expect(vested.toString()).to.equal(totalBalance.toString());
      } else {
        await expect(token.revoke(totalBalance)).to.be.revertedWith("Vesting is not revocable");
      }
    });
       
  });
  // ---------- VestingEdgeCase Module Tests ----------
  describe("Vesting Edge‐Case Releases", function () {
    before(function () {
      if (!inputData.enableVesting) {
        this.skip();
      }
    });
    const totalBalance = parseEther("1000");

  
    it("Should release tokens after cliff", async function () {
      await ethers.provider.send("evm_revert", [initialSnapshot]);
  
      await token.transfer(token.target, totalBalance);
  
      const cliffTs = Number(await token.cliff());
      const now     = (await ethers.provider.getBlock("latest"))!.timestamp;
      let delta     = cliffTs + 10 - now;
      if (delta <= 0) delta = 1;     
  

      await ethers.provider.send("evm_increaseTime", [delta]);
      await ethers.provider.send("evm_mine", []);
  
      const releasableBefore = await token.releasableAmount(totalBalance);
      await token.release(totalBalance);
      const released = await token.released();
      expect(released.toString()).to.equal(releasableBefore.toString());
    }); 
    
  });
  
});

