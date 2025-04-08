import { ethers } from "hardhat";
import { expect } from "chai";
import { parseEther } from "ethers";

describe("Gas Consumption Tests", function () {
  let token: any;

  before(async function () {
    const Token = await ethers.getContractFactory("TokenModificado");
    // REEMPLAZA los argumentos del constructor según corresponda
    token = await Token.deploy(/* CONSTRUCTOR_ARGS */);

  });

  it("Should measure gas consumption for transfers", async function () {
    const [owner, addr1] = await ethers.getSigners();
    const tx = await token.transfer(addr1.address, parseEther("10"));
    const receipt = await tx.wait();
    console.log("Gas used for transfer:", receipt.gasUsed.toString());
    expect(receipt.gasUsed).to.be.gt(BigInt(0));
  });
});
