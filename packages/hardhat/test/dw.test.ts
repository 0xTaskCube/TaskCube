import { expect } from "chai";
import { ethers } from "hardhat";
import { DepositWithdraw, ERC20Mock } from "../typechain-types";

import { parseEther, MaxUint256, Signer } from "ethers";

describe("DepositWithdraw", function () {
  let depositWithdraw: DepositWithdraw;
  let usdtToken: ERC20Mock;
  let owner: Signer;
  let user: Signer;
  const initialBalance = parseEther("1000");

  before(async () => {
    [owner, user] = await ethers.getSigners();

    // Deploy mock USDT token
    const ERC20MockFactory = await ethers.getContractFactory("ERC20Mock");
    usdtToken = (await ERC20MockFactory.deploy("Mock USDT", "USDT", initialBalance)) as ERC20Mock;
    await usdtToken.waitForDeployment();

    // Deploy DepositWithdraw contract
    const DepositWithdrawFactory = await ethers.getContractFactory("DepositWithdraw");
    depositWithdraw = (await DepositWithdrawFactory.deploy(await usdtToken.getAddress())) as DepositWithdraw;
    await depositWithdraw.waitForDeployment();

    // Approve DepositWithdraw contract to spend user's USDT
    await usdtToken.connect(user).approve(await depositWithdraw.getAddress(), MaxUint256);
  });

  describe("Deployment", function () {
    it("Should set the right USDT token address", async function () {
      expect(await depositWithdraw.usdtToken()).to.equal(await usdtToken.getAddress());
    });

    it("Should set the right owner", async function () {
      expect(await depositWithdraw.owner()).to.equal(await owner.getAddress());
    });
  });

  describe("Deposits", function () {
    it("Should allow user to deposit", async function () {
      const depositAmount = parseEther("100");
      await depositWithdraw.connect(user).deposit(depositAmount);

      const balance = await depositWithdraw.getBalance(await user.getAddress());
      expect(balance).to.equal(depositAmount);
    });

    it("Should fail if deposit amount is zero", async function () {
      await expect(depositWithdraw.connect(user).deposit(0)).to.be.revertedWith("Amount must be greater than 0");
    });
  });

  describe("Withdrawals", function () {
    it("Should allow user to request withdrawal", async function () {
      const withdrawAmount = parseEther("50");
      await depositWithdraw.connect(user).requestWithdrawal(withdrawAmount);

      const pendingWithdrawal = await depositWithdraw.getPendingWithdrawal(await user.getAddress());
      expect(pendingWithdrawal).to.equal(withdrawAmount);
    });

    it("Should allow owner to approve withdrawal", async function () {
      const userBalanceBefore = await usdtToken.balanceOf(await user.getAddress());
      await depositWithdraw.connect(owner).approveWithdrawal(await user.getAddress());
      const userBalanceAfter = await usdtToken.balanceOf(await user.getAddress());

      expect(userBalanceAfter > userBalanceBefore).to.be.true;
    });

    it("Should allow owner to reject withdrawal", async function () {
      const withdrawAmount = parseEther("25");
      await depositWithdraw.connect(user).requestWithdrawal(withdrawAmount);
      await depositWithdraw.connect(owner).rejectWithdrawal(await user.getAddress());

      const pendingWithdrawal = await depositWithdraw.getPendingWithdrawal(await user.getAddress());
      expect(pendingWithdrawal).to.equal(0n);

      const balance = await depositWithdraw.getBalance(await user.getAddress());
      expect(balance).to.equal(withdrawAmount);
    });
  });

  describe("Admin functions", function () {
    it("Should allow admin to withdraw", async function () {
      const withdrawAmount = parseEther("10");
      await depositWithdraw.connect(owner).adminWithdraw(withdrawAmount);

      const contractBalance = await usdtToken.balanceOf(await depositWithdraw.getAddress());
      expect(contractBalance).to.equal(initialBalance - withdrawAmount);
    });

    it("Should allow admin to deposit", async function () {
      const depositAmount = parseEther("5");
      await usdtToken.connect(owner).approve(await depositWithdraw.getAddress(), depositAmount);
      await depositWithdraw.connect(owner).adminDeposit(depositAmount);

      const contractBalance = await depositWithdraw.getContractBalance();
      expect(contractBalance).to.equal(initialBalance - parseEther("10") + depositAmount);
    });
  });
});
