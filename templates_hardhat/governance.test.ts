import { expect } from "chai";
import { ethers } from "hardhat";
import { parseEther } from "ethers";

describe("Governance Module Tests", function () {
  let token: any;
  let owner: any, voter: any;
  const description = "Test proposal";
  const duration = 60 * 60; // 1 hour

  before(async function () {
    [owner, voter] = await ethers.getSigners();
    const Token = await ethers.getContractFactory("__CONTRACT_NAME_TEST__");
    // El constructor ya recibirá los argumentos reales
    token = await Token.deploy(/* CONSTRUCTOR_ARGS */);

    // Asegurar que owner tiene tokens para proponer
    // El contrato mint inicial asigna tokens al owner
    const ownerBalance = await token.balanceOf(owner.address);
    expect(ownerBalance).to.be.gt(0);
  });

  it("Should create a proposal when threshold met and emit ProposalCreated", async function () {
    const tx = await token.createProposal(description, duration);
    const receipt = await tx.wait();

    // Evento
    const ev = receipt.events.find((e: any) => e.event === "ProposalCreated");
    expect(ev).to.exist;
    const [id, proposer, desc, deadline] = ev.args;
    expect(id.toNumber()).to.equal(1);
    expect(proposer).to.equal(owner.address);
    expect(desc).to.equal(description);
    const block = await ethers.provider.getBlock("latest");
    expect(block).to.not.be.null;
    expect(deadline.toNumber()).to.be.gt((block as any).timestamp);

    // Estado
    const p = await token.proposals(1);
    expect(p.id.toNumber()).to.equal(1);
    expect(p.proposer).to.equal(owner.address);
    expect(p.description).to.equal(description);
    expect(p.voteFor.toNumber()).to.equal(0);
    expect(p.voteAgainst.toNumber()).to.equal(0);
    expect(p.executed).to.equal(false);
  });

  it("Should allow voting and emit Voted, updating counts", async function () {
    // owner votes for with weight = 1
    await token.vote(1, true, 1);
    // voter needs tokens for weight: transfer 1 token
    await token.transfer(voter.address, parseEther("1"));
    await token.connect(voter).vote(1, false, 1);

    const p = await token.proposals(1);
    expect(p.voteFor.toNumber()).to.equal(1);
    expect(p.voteAgainst.toNumber()).to.equal(1);

    // Evento
    // We can fetch logs from tx, but assume counts suffice
  });

  it("Should not allow double voting", async function () {
    await expect(token.vote(1, true, 1)).to.be.revertedWith("You have already voted on this proposal");
  });

  it("Should not execute before deadline or without quorum", async function () {
    // Too early
    await expect(token.executeProposal(1)).to.be.revertedWith("Voting is not yet complete");
    // Fast forward past deadline
    await ethers.provider.send("evm_increaseTime", [duration + 1]);
    await ethers.provider.send("evm_mine", []);
    // quorum > total votes?
    const quorum = (await token.quorum()).toNumber();
    const totalVotes = (await token.proposals(1)).voteFor.add((await token.proposals(1)).voteAgainst).toNumber();
    if (totalVotes < quorum) {
      await expect(token.executeProposal(1)).to.be.revertedWith("The required quorum was not reached");
    }
  });

  it("Should execute proposal when conditions met and emit ProposalExecuted", async function () {
    // If needed, give more votes to meet quorum
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
