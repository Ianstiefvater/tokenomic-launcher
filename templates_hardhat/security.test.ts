import { expect } from "chai";
import { ethers } from "hardhat";
import { parseEther} from "ethers";

describe("Security Tests", function () {
  let token: any;
  let owner: any, attacker: any, user: any;

  before(async function () {
    [owner, attacker, user] = await ethers.getSigners();
    const Token = await ethers.getContractFactory("__CONTRACT_NAME_TEST__");
    token = await Token.deploy(/* CONSTRUCTOR_ARGS */);
  });

  it("Should revert on arithmetic overflow/underflow", async function () {
    // Intenta transferir un amount mayor al uint256 max
    const max = BigInt(2) ** BigInt(256) - BigInt(1);
    await expect(token.transfer(user.address, max)).to.be.reverted;
    // Intenta aprobar allowance muy grande y usar transferFrom
    await token.approve(user.address, parseEther("1"));
    await expect(
      token.connect(user).transferFrom(owner.address, user.address, max)
    ).to.be.reverted;
  });

  it("Should resist DoS by many proposals in governance", async function () {
    // Creamos muchos proposals para saturar mapping
    const threshold = await token.proposalThreshold();
    // Aseguramos que owner tenga tokens >= threshold
    await token.transfer(owner.address, threshold);
    for (let i = 0; i < 200; i++) {
      await token.createProposal(`desc${i}`, 60);
    }
    // Ejecutar un proposal tras deadline para ver si consume demasiado gas
    await ethers.provider.send("evm_increaseTime", [61]);
    await ethers.provider.send("evm_mine", []);
    await expect(token.executeProposal(1)).to.not.be.reverted;
  });

  it("Should be safe against front-running in transfer fees", async function () {
    // Simulamos dos transfers rápidas para ver que el fee se calcula individualmente
    const amt = parseEther("10");
    const fee1 = await token._calculateTotalFee(amt);
    await token.transfer(user.address, amt);
    const fee2 = await token._calculateTotalFee(amt);
    expect(fee1.toString()).to.equal(fee2.toString());
  });
});
