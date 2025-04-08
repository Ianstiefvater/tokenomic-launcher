import { expect } from "chai";
import { ethers } from "hardhat";
import { parseEther } from "ethers";

describe("Deflation Module Tests", function () {
  let token: any;
  let owner: any;

  before(async function () {
    [owner] = await ethers.getSigners();
    const Token = await ethers.getContractFactory("__CONTRACT_NAME_TEST__");
    try {
      token = await Token.deploy(/* CONSTRUCTOR_ARGS */);
    } catch (e: any) {
      console.error("Deploy failed:", e.message);
      throw e;
    }
  });


  it("Should reduce the contract's token balance via buyback and burn", async function () {
    // Para que la función executeBuybackAndBurn() funcione, el contrato debe tener tokens disponibles.
    // Transferimos una cantidad de tokens desde el owner al contrato.
    const contractAddress = token.address;
    const transferAmount = parseEther("100");
    await token.transfer(contractAddress, transferAmount);
    
    const balanceBefore = await token.balanceOf(contractAddress);
    // Ejecuta la función de buyback y burn.
    await token.executeBuybackAndBurn();
    const balanceAfter = await token.balanceOf(contractAddress);
    
    // Se espera que el balance del contrato disminuya.
    expect(balanceAfter).to.be.lt(balanceBefore);
  });

  it("Should decrease the total supply after buyback and burn", async function () {
    // Obtenemos el suministro total antes de la operación
    const totalSupplyBefore = await token.totalSupply();
    
    // Aseguramos que el contrato tenga tokens para que executeBuybackAndBurn() ejecute la quema.
    const contractAddress = token.address;
    const transferAmount = parseEther("50");
    await token.transfer(contractAddress, transferAmount);
    
    await token.executeBuybackAndBurn();
    const totalSupplyAfter = await token.totalSupply();
    
    // Se espera que el suministro total disminuya tras la quema.
    expect(totalSupplyAfter).to.be.lt(totalSupplyBefore);
  });
});
