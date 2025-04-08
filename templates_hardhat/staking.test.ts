import { expect } from "chai";
import { ethers } from "hardhat";
import { parseEther } from "ethers";

describe("Staking Module Tests", function () {
  let token: any;
  let owner: any;
  let staker: any;
  let minStakingPeriod: number;
  let stakingRewardRate: number;
  let yieldFarmingBonusRate: number;

  before(async function () {
    [owner, staker] = await ethers.getSigners();
    // Usamos la versión pública del contrato, con "Test" añadido al nombre.
    const Token = await ethers.getContractFactory("__CONTRACT_NAME_TEST__");
    // Los argumentos del constructor serán reemplazados automáticamente por testAndReport.ts
    token = await Token.deploy(/* CONSTRUCTOR_ARGS */);


    // Recuperar los parámetros de staking del contrato
    minStakingPeriod = Number((await token.minStakingPeriod()).toString());
    stakingRewardRate = Number((await token.stakingRewardRate()).toString());
    yieldFarmingBonusRate = Number((await token.yieldFarmingBonusRate()).toString());
  });

  it("Should allow staking correctly and emit Staked event", async function () {
    const stakeAmount = parseEther("10");
    // Conectar como staker
    const tx = await token.connect(staker).stake(stakeAmount);
    const receipt = await tx.wait();

    // Verificar que se emita el evento Staked con el staker y el monto correcto
    const event = receipt.events.find((e: any) => e.event === "Staked");
    expect(event, "Staked event was not emitted").to.exist;
    expect(event.args.staker).to.equal(staker.address);
    expect(event.args.amount.toString()).to.equal(stakeAmount.toString());

    // Verificar que el stake se registre correctamente en la estructura mapping
    const stakeData = await token.stakes(staker.address);
    expect(stakeData.amount.toString()).to.equal(stakeAmount.toString());
    expect(Number(stakeData.startTime)).to.be.gt(0);
  });

  it("Should calculate reward correctly after time increase", async function () {
    // Aumentar el tiempo en minStakingPeriod + 1 segundo
    await ethers.provider.send("evm_increaseTime", [minStakingPeriod + 1]);
    await ethers.provider.send("evm_mine", []);
    
    // Recuperar la información del stake
    const stakeData = await token.stakes(staker.address);
    const block = await ethers.provider.getBlock("latest");
    if (!block) throw new Error("Failed to fetch latest block");
    const stakingDuration = block.timestamp - Number(stakeData.startTime);

    
    // Calcular el totalRate = stakingRewardRate + yieldFarmingBonusRate
    const totalRate = stakingRewardRate + yieldFarmingBonusRate;
    // Fórmula: reward = (stakedAmount * totalRate * stakingDuration) / (365 days * 100)
    const expectedReward = (BigInt(stakeData.amount.toString()) * BigInt(totalRate) * BigInt(stakingDuration))
                           / (BigInt(365 * 24 * 3600) * BigInt(100));
    
    const reward = await token.calculateReward(staker.address);
    expect(reward.toString()).to.equal(expectedReward.toString());
  });

  it("Should allow unstaking correctly, emit Unstaked event and transfer tokens", async function () {
    // Antes de unstake, capturamos el stake del staker y su balance
    const stakeDataBefore = await token.stakes(staker.address);
    const stakedAmount = stakeDataBefore.amount;
    const initialBalance = await token.balanceOf(staker.address);
    
    // Asegurarse de que el tiempo mínimo de staking se cumple
    await ethers.provider.send("evm_increaseTime", [1]); // un segundo adicional
    await ethers.provider.send("evm_mine", []);

    // Unstake y obtener el recibo
    const tx = await token.connect(staker).unstake();
    const receipt = await tx.wait();

    // Verificar que se emita el evento Unstaked
    const event = receipt.events.find((e: any) => e.event === "Unstaked");
    expect(event, "Unstaked event was not emitted").to.exist;
    // El evento debe mostrar el monto total (stake + reward) y la recompensa
    const unstakedTotal = event.args.amount;
    const rewardEmitted = event.args.reward;
    
    // Verificar que la estructura del stake se haya reiniciado
    const stakeDataAfter = await token.stakes(staker.address);
    expect(stakeDataAfter.amount.toString()).to.equal("0");
    expect(stakeDataAfter.startTime.toString()).to.equal("0");
    
    // Verificar que el balance del staker aumentó en la cantidad total recibida
    const finalBalance = await token.balanceOf(staker.address);
    expect(finalBalance.sub(initialBalance).toString()).to.equal(unstakedTotal.toString());
  });
});
