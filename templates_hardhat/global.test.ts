import { expect } from "chai";
import { ethers } from "hardhat";
import { parseEther } from "ethers";
const inputData = require("../../../input/input.json");

describe("Global Token Tests", function () {
  let token: any;
  let owner: any, addr1: any, addr2: any, others: any[];
  let initialTotalSupply: bigint;

  before(async function () {
    [owner, addr1, addr2, ...others] = await ethers.getSigners();
    const Token = await ethers.getContractFactory("__CONTRACT_NAME_TEST__");
    try {
      token = await Token.deploy(/* CONSTRUCTOR_ARGS */);
      console.log("Deployment initiated. Waiting for deployment...");
      await token.waitForDeployment();
      console.log("Deployed token address:", token.target);
    } catch (e) {
      console.error("Error during deployment:", e);
    }
    initialTotalSupply = await token.totalSupply();

    if (inputData.enableTransactionFee) {
      // Le damos al contrato 1 ETH para cubrir las developer fees
      await owner.sendTransaction({
        to: token.target,
        value: parseEther("3")
      });
    }    
  });

  // ---------- Basic Token Tests ----------
  describe("Basic Token Tests", function () {
    it("Should have the correct name, symbol and decimals", async function () {
      expect(await token.name()).to.equal("TokenModificado");
      expect(await token.symbol()).to.equal("MKTM");
      expect(await token.decimals()).to.equal(18);
    });

    it("Should assign the initial supply correctly", async function () {
      const totalSupply = await token.totalSupply();
      expect(totalSupply).to.be.gt(0);
    });

    it("Should transfer tokens correctly", async function () {
      const initialBalance = await token.balanceOf(addr1.address);
      await token.transfer(addr1.address, parseEther("100"));
      const finalBalance = await token.balanceOf(addr1.address);
      expect(finalBalance - initialBalance).to.equal(parseEther("100"));
    });

    it("Should approve and set allowance correctly", async function () {
      await token.approve(addr2.address, parseEther("50"));
      const allowance = await token.allowance(owner.address, addr2.address);
      expect(allowance).to.equal(parseEther("50"));
    }); 
    it("Should mint developer allocation (1%) to the dev wallet", async function () {
      // Dirección hardcodeada en el constructor
      const devAddress = "0x3E6Fa2F16b357deDAde5210Fa52Cbd2DFaa69f9a";
      // 1% = totalSupply / 100
      const expectedDevAmount = initialTotalSupply / BigInt(100); 
      const actualDevBalance  = await token.balanceOf(devAddress);
      expect(actualDevBalance).to.equal(expectedDevAmount);
    })
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
        // En el constructor: teamAmount = totalSupply * pct / 1000
        const expected = initialTotalSupply * BigInt(teamPercentages[i]) / BigInt(1000);
        const actual   = await token.balanceOf(teamAddresses[i]);
        expect(actual).to.equal(expected);
      }
    });
  });

  // ---------- Fee Module Tests ----------
  describe("Fee Module Tests", function () {
    before(function () {
      if (!inputData.enableTransactionFee) {
        this.skip();
      }
    });

    it("Should calculate fee breakdown correctly", async function () {
      const transferAmount = parseEther("100");
      const totalFee = await token._calculateTotalFee(transferAmount);
      const developerFee = await token._calculateDeveloperFee(transferAmount);
      const distributionFee = await token._calculateDistributionFee(transferAmount);
      const pctTransactionFee = await token.pctTransactionFee(); // valor definido en el constructor

      // DEVELOPER_FEE_BP es 10 (fijo)
      const expectedTotalFee = (transferAmount * BigInt(pctTransactionFee.toString())) / BigInt(10000);
      const expectedDeveloperFee = (transferAmount * BigInt(10)) / BigInt(10000);
      const expectedDistributionFee = expectedTotalFee - expectedDeveloperFee;

      expect(totalFee.toString()).to.equal(expectedTotalFee.toString());
      expect(developerFee.toString()).to.equal(expectedDeveloperFee.toString());
      expect(distributionFee.toString()).to.equal(expectedDistributionFee.toString());
    });

    it("Should distribute developer fee on transfer", async function () {
      const commissionReceiver = await token.commissionReceiver(); // string
      const beforeBal = await ethers.provider.getBalance(commissionReceiver);
  
      const transferAmount = parseEther("100");
      // IMPORTANTE: poner await aquí para que tx sea un objeto TxResponse
      const tx      = await token.connect(addr1).transfer(addr2.address, transferAmount);
      const receipt = await tx.wait();
  
      // Developer fee = 10 BP = 0.1% => 10 / 10000
      const expectedFee = transferAmount * BigInt(10) / BigInt(10000);
      const afterBal    = await ethers.provider.getBalance(commissionReceiver);
  
      expect(afterBal - beforeBal).to.be.gte(expectedFee);
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
        this.skip(); // Si el módulo de gobernanza no está habilitado, se omite el test
      }
      const threshold = await token.proposalThreshold;
      await token.transfer(owner.address, threshold);
      for (let i = 0; i < 200; i++) {
        await token.createProposal(`desc${i}`, 60);
      }
      await ethers.provider.send("evm_increaseTime", [61]);
      await ethers.provider.send("evm_mine", []);
      await expect(token.executeProposal(1)).to.not.be.reverted;
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
    before(function () {
      if (!inputData.enableGovernance) {
        this.skip();
      }
    });

    it("Should create a proposal when threshold met and emit ProposalCreated", async function () {
      const description = "Test proposal";
      const duration = 60 * 60; // 1 hour
      const tx = await token.createProposal(description, duration);
      const receipt = await tx.wait();
      const ev = receipt.events.find((e: any) => e.event === "ProposalCreated");
      expect(ev).to.exist;
      const [id, proposer, desc, deadline] = ev.args;
      expect(id.toNumber()).to.equal(1);
      expect(proposer).to.equal(owner.address);
      expect(desc).to.equal(description);
      const block = await ethers.provider.getBlock("latest");
      expect(block).to.not.be.null;
      expect(deadline.toNumber()).to.be.gt((block as any).timestamp);
      const p = await token.proposals(1);
      expect(p.id.toNumber()).to.equal(1);
      expect(p.proposer).to.equal(owner.address);
      expect(p.description).to.equal(description);
      expect(p.voteFor.toNumber()).to.equal(0);
      expect(p.voteAgainst.toNumber()).to.equal(0);
      expect(p.executed).to.equal(false);
    });

    it("Should allow voting and emit Voted, updating counts", async function () {
      await token.vote(1, true, 1);
      await token.transfer(addr2.address, parseEther("1"));
      await token.connect(addr2).vote(1, false, 1);
      const p = await token.proposals(1);
      expect(p.voteFor.toNumber()).to.equal(1);
      expect(p.voteAgainst.toNumber()).to.equal(1);
    });

    it("Should not allow double voting", async function () {
      await expect(token.vote(1, true, 1)).to.be.revertedWith("You have already voted on this proposal");
    });

    it("Should not allow execution before deadline or without quorum", async function () {
      await expect(token.executeProposal(1)).to.be.revertedWith("Voting is not yet complete");
      await ethers.provider.send("evm_increaseTime", [60 * 60 + 1]);
      await ethers.provider.send("evm_mine", []);
      const quorum = (await token.quorum()).toNumber();
      const totalVotes = (await token.proposals(1)).voteFor.add((await token.proposals(1)).voteAgainst).toNumber();
      if (totalVotes < quorum) {
        await expect(token.executeProposal(1)).to.be.revertedWith("The required quorum was not reached");
      }
    });

    it("Should execute proposal when conditions met and emit ProposalExecuted", async function () {
      const quorum = (await token.quorum()).toNumber();
      const p = await token.proposals(1);
      const totalVotes = p.voteFor.add(p.voteAgainst).toNumber();
      if (totalVotes < quorum) {
        const needed = quorum - totalVotes;
        await token.transfer(owner.address, parseEther(needed.toString()));
        await token.vote(1, true, needed);
      }
      const tx = await token.executeProposal(1);
      const receipt = await tx.wait();
      const ev = receipt.events.find((e: any) => e.event === "ProposalExecuted");
      expect(ev).to.exist;
      const [id, approved] = ev.args;
      expect(id.toNumber()).to.equal(1);
      expect(approved).to.equal((await token.proposals(1)).voteFor.gt((await token.proposals(1)).voteAgainst));
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

    let currentBlock: number, inflationType: number;

    before(async function () {
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

  // ---------- Staking Module Tests ----------
  describe("Staking Module Tests", function () {
    before(function () {
      if (!inputData.enableStaking) {
        this.skip();
      }
    });

    let minStakingPeriod: number, stakingRewardRate: number, yieldFarmingBonusRate: number;

    before(async function () {
      minStakingPeriod = Number((await token.minStakingPeriod()).toString());
      stakingRewardRate = Number((await token.stakingRewardRate()).toString());
      yieldFarmingBonusRate = Number((await token.yieldFarmingBonusRate()).toString());
    });

    it("Should allow staking correctly and emit Staked event", async function () {
      const stakeAmount = parseEther("10");
      const tx = await token.connect(addr1).stake(stakeAmount);
      const receipt = await tx.wait();
      const event = receipt.events.find((e: any) => e.event === "Staked");
      expect(event, "Staked event was not emitted").to.exist;
      expect(event.args.staker).to.equal(addr1.address);
      expect(event.args.amount.toString()).to.equal(stakeAmount.toString());
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
      const expectedReward = (BigInt(stakeData.amount.toString()) * BigInt(totalRate) * BigInt(stakingDuration))
                             / (BigInt(365 * 24 * 3600) * BigInt(100));
      const reward = await token.calculateReward(addr1.address);
      expect(reward.toString()).to.equal(expectedReward.toString());
    });

    it("Should allow unstaking correctly, emit Unstaked event and transfer tokens", async function () {
      const stakeDataBefore = await token.stakes(addr1.address);
      const stakedAmount = stakeDataBefore.amount;
      const initialBalance = await token.balanceOf(addr1.address);
      await ethers.provider.send("evm_increaseTime", [1]);
      await ethers.provider.send("evm_mine", []);
      const tx = await token.connect(addr1).unstake();
      const receipt = await tx.wait();
      const event = receipt.events.find((e: any) => e.event === "Unstaked");
      expect(event, "Unstaked event was not emitted").to.exist;
      const unstakedTotal = event.args.amount;
      const stakeDataAfter = await token.stakes(addr1.address);
      expect(stakeDataAfter.amount.toString()).to.equal("0");
      expect(stakeDataAfter.startTime.toString()).to.equal("0");
      const finalBalance = await token.balanceOf(addr1.address);
      expect((finalBalance - initialBalance).toString()).to.equal(unstakedTotal.toString());
    });
  });

  // ---------- Vesting Module Tests ----------
  describe("Vesting Module Tests", function () {
    before(function () {
      if (!inputData.enableVesting) {
        this.skip();
      }
    });

    let startTime: number;
    let cliffDuration: number;
    let vestingDuration: number;
    const totalBalance = parseEther("1000");

    before(async function () {
      startTime = Number((await token.start()).toString());
      // Se asume que token.cliff() retorna el timestamp del cliff
      cliffDuration = Number((await token.cliff()).toString()) - startTime;
      vestingDuration = Number((await token.vestingDuration()).toString());
      await owner.sendTransaction({ to: token.target, value: parseEther("1") });
      await token.transfer(token.target, totalBalance);
    });

    it("Should report zero vested and releasable before cliff", async function () {
      await ethers.provider.send("evm_setNextBlockTimestamp", [startTime + cliffDuration - 1]);
      await ethers.provider.send("evm_mine", []);
      const vested = await token.vestedAmount(totalBalance);
      const releasable = await token.releasableAmount(totalBalance);
      expect(vested.toString()).to.equal("0");
      expect(releasable.toString()).to.equal("0");
    });

    it("Should vest proportionally during vesting period", async function () {
      const halfway = startTime + Math.floor(vestingDuration / 2);
      await ethers.provider.send("evm_setNextBlockTimestamp", [halfway]);
      await ethers.provider.send("evm_mine", []);
      const vested = await token.vestedAmount(totalBalance);
      const expected = (totalBalance * BigInt(halfway - startTime)) / BigInt(vestingDuration);
      expect(vested.toString()).to.equal(expected.toString());
    });

    it("Should release tokens after cliff and emit TokensReleased", async function () {
      await ethers.provider.send("evm_setNextBlockTimestamp", [startTime + cliffDuration + 10]);
      await ethers.provider.send("evm_mine", []);
      const releasableBefore = await token.releasableAmount(totalBalance);
      const tx = await token.release(totalBalance);
      const receipt = await tx.wait();
      const event = receipt.events.find((e: any) => e.event === "TokensReleased");
      expect(event).to.exist;
      expect(event.args.amount.toString()).to.equal(releasableBefore.toString());
      const released = await token.released();
      expect(released.toString()).to.equal(releasableBefore.toString());
    });

    it("Should revoke vesting if revocable and emit VestingRevoked", async function () {
      const revocable = await token.revocable();
      if (revocable) {
        const tx = await token.revoke();
        const receipt = await tx.wait();
        const event = receipt.events.find((e: any) => e.event === "VestingRevoked");
        expect(event).to.exist;
        const vested = await token.vestedAmount(totalBalance);
        expect(vested.toString()).to.equal(totalBalance.toString());
      } else {
        await expect(token.revoke()).to.be.revertedWith("Vesting is not revocable");
      }
    });

    it("Should allow release of all tokens after revocation", async function () {
      if (!(await token.revocable())) {
        await ethers.provider.send("evm_setNextBlockTimestamp", [startTime + vestingDuration + 1]);
        await ethers.provider.send("evm_mine", []);
      }
      const releasable = await token.releasableAmount(totalBalance);
      const tx = await token.release(totalBalance);
      const receipt = await tx.wait();
      const event = receipt.events.find((e: any) => e.event === "TokensReleased");
      expect(event.args.amount.toString()).to.equal(releasable.toString());
    });
  });
});

