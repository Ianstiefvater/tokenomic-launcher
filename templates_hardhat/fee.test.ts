import { expect } from "chai";
import { ethers } from "hardhat";
import { parseEther } from "ethers";

describe("Fee Module Tests", function () {
  let token: any;
  let owner: any, addr1: any, commissionReceiver: any;

  before(async function () {
    [owner, addr1, commissionReceiver] = await ethers.getSigners();
    // Se asume que testAndReport.ts ha generado la versión pública del contrato con el sufijo "Test"
    const Token = await ethers.getContractFactory("__CONTRACT_NAME_TEST__");
    // Los argumentos del constructor serán reemplazados automáticamente por testAndReport.ts
    token = await Token.deploy(/* CONSTRUCTOR_ARGS */);

    // Para que el contrato tenga fondos y pueda cubrir el developer fee, le enviamos ETH
    await owner.sendTransaction({ to: token.address, value: parseEther("1") });
  });

  it("Should calculate fee breakdown correctly", async function () {
    const transferAmount = parseEther("100");
    const totalFee = await token._calculateTotalFee(transferAmount);
    const developerFee = await token._calculateDeveloperFee(transferAmount);
    const distributionFee = await token._calculateDistributionFee(transferAmount);

    // Se obtienen los parámetros reales usados en el contrato
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
    // Se registra el balance inicial de ETH del commissionReceiver
    const initialEthBalance = await ethers.provider.getBalance(commissionReceiver.address);
    
    const transferAmount = parseEther("100");
    const tx = await token.transfer(addr1.address, transferAmount);
    await tx.wait();

    // Se calcula el developer fee esperado: (transferAmount * DEVELOPER_FEE_BP)/10000
    const expectedDeveloperFee = (transferAmount * BigInt(10)) / BigInt(10000);
    const finalEthBalance = await ethers.provider.getBalance(commissionReceiver.address);
    
    // Se espera que el commissionReceiver reciba al menos el fee del desarrollador
    expect(finalEthBalance - initialEthBalance).to.be.gte(expectedDeveloperFee);
  });
});

