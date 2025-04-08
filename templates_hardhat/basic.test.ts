import { expect } from "chai";
import { ethers } from "hardhat";
import { parseEther } from "ethers";

describe("Basic Token Tests", function () {
  let token: any;
  let owner: any, addr1: any, addr2: any;

  before(async function () {
    [owner, addr1, addr2] = await ethers.getSigners();
    const Token = await ethers.getContractFactory("__CONTRACT_NAME_TEST__");
    // REEMPLAZA los argumentos del constructor según corresponda
    token = await Token.deploy(/* CONSTRUCTOR_ARGS */);
  });

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
});


