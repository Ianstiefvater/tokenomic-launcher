import { expect } from "chai";
import { ethers } from "hardhat";
import { parseEther } from "ethers";

describe("Vesting Module Tests", function () {
  let token: any;
  let owner: any, beneficiary: any;
  let start: number;
  let cliffDuration: number;
  let vestingDuration: number;
  const totalBalance = parseEther("1000");

  before(async function () {
    [owner, beneficiary] = await ethers.getSigners();
    const Token = await ethers.getContractFactory("__CONTRACT_NAME_TEST__");
    // Los argumentos del constructor serán reemplazados automáticamente por testAndReport.ts,
    // incluyendo el parámetro vestingStart (_start).
    token = await Token.deploy(/* CONSTRUCTOR_ARGS */);


    // Leer los parámetros públicos del contrato
    start = Number((await token.start()).toString());
    cliffDuration = Number((await token.cliff()).toString()) - start;
    vestingDuration = Number((await token.vestingDuration()).toString());

    // Asegurar que el contrato tenga tokens para liberar
    await owner.sendTransaction({ to: token.address, value: parseEther("1") });
    // Y simular que el contrato tiene `totalBalance` tokens para el beneficiary
    // Por ejemplo, mint o transferencia previa (depende de tu implementación)
    await token.transfer(token.address, totalBalance);
  });

  it("Should report zero vested and releasable before cliff", async function () {
    // Justo antes del cliff
    await ethers.provider.send("evm_setNextBlockTimestamp", [start + cliffDuration - 1]);
    await ethers.provider.send("evm_mine", []);
    
    const vested = await token.vestedAmount(totalBalance);
    const releasable = await token.releasableAmount(totalBalance);
    expect(vested.toString()).to.equal("0");
    expect(releasable.toString()).to.equal("0");
  });

  it("Should vest proportionally during vesting period", async function () {
    // A mitad del periodo de vesting
    const halfway = start + Math.floor(vestingDuration / 2);
    await ethers.provider.send("evm_setNextBlockTimestamp", [halfway]);
    await ethers.provider.send("evm_mine", []);
    
    const vested = await token.vestedAmount(totalBalance);
    // Esperamos aproximadamente la mitad de totalBalance
    const expected = (totalBalance * BigInt(halfway - start)) / BigInt(vestingDuration);
    expect(vested.toString()).to.equal(expected.toString());
  });

  it("Should release tokens after cliff and emit TokensReleased", async function () {
    // Después del cliff
    await ethers.provider.send("evm_setNextBlockTimestamp", [start + cliffDuration + 10]);
    await ethers.provider.send("evm_mine", []);
    
    const releasableBefore = await token.releasableAmount(totalBalance);
    const tx = await token.release(totalBalance);
    const receipt = await tx.wait();
    
    // Evento TokensReleased
    const event = receipt.events.find((e: any) => e.event === "TokensReleased");
    expect(event).to.exist;
    expect(event.args.amount.toString()).to.equal(releasableBefore.toString());
    
    // Verificar que released haya aumentado
    const released = await token.released();
    expect(released.toString()).to.equal(releasableBefore.toString());
  });

  it("Should revoke vesting if revocable and emit VestingRevoked", async function () {
    const revocable = await token.revocable();
    if (revocable) {
      // Owner revoca
      const tx = await token.revoke();
      const receipt = await tx.wait();
      const event = receipt.events.find((e: any) => e.event === "VestingRevoked");
      expect(event).to.exist;

      // Después de revocar, vestedAmount debe ser totalBalance
      const vested = await token.vestedAmount(totalBalance);
      expect(vested.toString()).to.equal(totalBalance.toString());
    } else {
      await expect(token.revoke()).to.be.revertedWith("Vesting is not revocable");
    }
  });

  it("Should allow release of all tokens after revocation", async function () {
    // Tras revocar (o si no es revocable, simulamos tiempo completo)
    if (!(await token.revocable())) {
      // Simular fin del vesting
      await ethers.provider.send("evm_setNextBlockTimestamp", [start + vestingDuration + 1]);
      await ethers.provider.send("evm_mine", []);
    }
    const releasable = await token.releasableAmount(totalBalance);
    const tx = await token.release(totalBalance);
    const receipt = await tx.wait();
    const event = receipt.events.find((e: any) => e.event === "TokensReleased");
    expect(event.args.amount.toString()).to.equal(releasable.toString());
  });
});

