"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { ChevronDown, Info } from "lucide-react";
import { formatUnits, parseUnits } from "viem";
import { decodeEventLog } from "viem";
import { useAccount, useBalance, usePublicClient, useWalletClient } from "wagmi";
import { ClipboardDocumentCheckIcon } from "@heroicons/react/24/outline";
import { RainbowKitCustomConnectButton } from "~~/components/scaffold-eth";
import { useScaffoldContract } from "~~/hooks/scaffold-eth";
import { notification } from "~~/utils/scaffold-eth";

const USDT_ADDRESS = "0xaA8E23Fb1079EA71e0a56F48a2aA51851D8433D0";
const usdtAbi = [
  {
    constant: false,
    inputs: [
      { name: "_spender", type: "address" },
      { name: "_value", type: "uint256" },
    ],
    name: "approve",
    outputs: [{ name: "", type: "bool" }],
    type: "function",
  },
] as const;

const DepositWithdrawalPage = () => {
  const [availableBalance, setAvailableBalance] = useState("0");
  const [, setWithdrawalRequestId] = useState<string | null>(null);
  const { data: walletClient } = useWalletClient();
  const { address, isConnected } = useAccount();
  const [activeTab, setActiveTab] = useState("deposit");
  const [usdtAmount, setUsdtAmount] = useState("0");
  const [selectedToken] = useState("USDT");
  const [isLoading, setIsLoading] = useState(false);
  const [transactionRecords, setTransactionRecords] = useState<
    Array<{
      type: string;
      amount: string;
      date: string;
      status: string;
    }>
  >([]);
  const [platformBalance, setPlatformBalance] = useState("0");
  const [gasPrice, setGasPrice] = useState<bigint | null>(null);
  const [isGasPriceLoading, setIsGasPriceLoading] = useState(true);
  const [gasPriceError, setGasPriceError] = useState<Error | null>(null);

  const { data: depositWithdrawContract, isLoading: isContractLoading } = useScaffoldContract({
    contractName: "DepositWithdraw",
  });

  const { data: usdtBalanceData, isLoading: isUsdtBalanceLoading } = useBalance({
    address: address,
    token: USDT_ADDRESS,
  });

  const [usdtBalance, setUsdtBalance] = useState("0");

  const publicClient = usePublicClient();

  useEffect(() => {
    if (walletClient && depositWithdrawContract && address) {
      // 预热 walletClient 和 contract
      walletClient.getAddresses();
      depositWithdrawContract.read.getBalance([address as `0x${string}`]).catch(error => {
        // 忽略预热过程中的错误
        console.debug("预热 getBalance 调用失败:", error);
      });
    }
  }, [walletClient, depositWithdrawContract, address]);

  useEffect(() => {
    const fetchGasPrice = async () => {
      if (!publicClient) return;

      setIsGasPriceLoading(true);
      try {
        const fetchedGasPrice = await publicClient.getGasPrice();
        console.log("Fetched gas price (Wei):", fetchedGasPrice.toString());
        setGasPrice(fetchedGasPrice);
        setGasPriceError(null);
      } catch (error) {
        console.error("Error fetching gas price:", error);
        setGasPriceError(error as Error);
      } finally {
        setIsGasPriceLoading(false);
      }
    };

    if (publicClient) {
      fetchGasPrice();
      const intervalId = setInterval(fetchGasPrice, 60000);
      return () => clearInterval(intervalId);
    }
  }, [publicClient]);

  const formatGasPrice = useCallback(() => {
    console.log("Current gasPrice:", gasPrice);
    if (isGasPriceLoading) return "Loading...";
    if (gasPriceError) return "Error fetching gas price";
    if (gasPrice === null) return "N/A";

    const gasPriceInGwei = formatUnits(gasPrice, 9);
    console.log("Gas price in Gwei:", gasPriceInGwei);
    return `${parseFloat(gasPriceInGwei).toFixed(2)} Gwei`;
  }, [gasPrice, isGasPriceLoading, gasPriceError]);

  const updatePlatformBalance = useCallback(async () => {
    if (address && depositWithdrawContract) {
      try {
        // 获取用户在合约中的总存款余额
        const totalDeposit = await depositWithdrawContract.read.getTotalDeposit([address as `0x${string}`]);
        const formattedTotalDeposit = formatUnits(totalDeposit, 6);

        // 获取待处理的提现总额和已执行的提现总额
        const response = await fetch(`/api/DepositWithdrawal?userAddress=${address}&action=getBalance`);
        const data = await response.json();

        if (data.success) {
          const pendingWithdrawals = data.pendingWithdrawalsTotal;
          const executedWithdrawals = data.executedWithdrawalsTotal;

          // 设置平台总余额（总存款减去已执行的提现）
          const platformBalanceValue = Math.max(0, parseFloat(formattedTotalDeposit) - parseFloat(executedWithdrawals));
          setPlatformBalance(platformBalanceValue.toFixed(2));

          // 计算可用余额（平台总余额减去待处理的提现）
          const availableBalanceValue = Math.max(0, platformBalanceValue - parseFloat(pendingWithdrawals));
          setAvailableBalance(availableBalanceValue.toFixed(2));

          console.log("用户总存款:", formattedTotalDeposit);
          console.log("已执行提现总额:", executedWithdrawals);
          console.log("待处理提现总额:", pendingWithdrawals);
          console.log("平台总余额:", platformBalanceValue.toFixed(2));
          console.log("用户可用余额:", availableBalanceValue.toFixed(6));
        } else {
          console.error("获取余额信息失败:", data.error);
          setPlatformBalance(formattedTotalDeposit);
          setAvailableBalance(formattedTotalDeposit);
        }
      } catch (error) {
        console.error("获取用户余额失败:", error);
      }
    }
  }, [address, depositWithdrawContract]);

  const fetchTransactionRecords = useCallback(async () => {
    if (address) {
      try {
        const response = await fetch(
          `/api/DepositWithdrawal?userAddress=${address}&action=getTransactions&status=success,pending`,
        );
        const data = await response.json();
        if (data.success) {
          console.log("API 返回的交易记录:", data.transactions);
          setTransactionRecords(data.transactions);
        } else {
          console.error("获取交易记录失败:", data.error);
        }
      } catch (error) {
        console.error("获取交易记录失败:", error);
      }
    }
  }, [address]);

  useEffect(() => {
    if (usdtBalanceData) {
      setUsdtBalance(formatUnits(usdtBalanceData.value, 6)); // USDT 使用 6 位小数
    }
    updatePlatformBalance();
  }, [usdtBalanceData, updatePlatformBalance, activeTab]);

  useEffect(() => {
    if (isConnected) {
      fetchTransactionRecords();
    }
  }, [isConnected, fetchTransactionRecords]);

  const handleTransaction = useCallback(async () => {
    if (!isConnected || !depositWithdrawContract || !walletClient || !publicClient) {
      notification.error("请先连接钱包");
      return;
    }

    setIsLoading(true);

    try {
      const parsedAmount = parseUnits(usdtAmount, 6);

      if (activeTab === "deposit") {
        // 存款逻辑
        const { request } = await publicClient.simulateContract({
          account: address,
          address: USDT_ADDRESS,
          abi: usdtAbi,
          functionName: "approve",
          args: [depositWithdrawContract.address, parsedAmount],
        });
        const approveTx = await walletClient.writeContract(request);
        await publicClient.waitForTransactionReceipt({ hash: approveTx });

        const { request: depositRequest } = await publicClient.simulateContract({
          account: address,
          address: depositWithdrawContract.address,
          abi: depositWithdrawContract.abi,
          functionName: "deposit",
          args: [parsedAmount],
        });
        const depositTx = await walletClient.writeContract(depositRequest);

        // 等待交易确认
        await publicClient.waitForTransactionReceipt({ hash: depositTx });

        // 只有在交易确认后，才记录交易
        await fetch("/api/DepositWithdrawal", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            userAddress: address,
            amount: usdtAmount,
            type: "deposit",
            status: "completed",
          }),
        });

        notification.success("存款成功");
      } else {
        // 提现逻辑
        const { request } = await publicClient.simulateContract({
          account: address,
          address: depositWithdrawContract.address,
          abi: depositWithdrawContract.abi,
          functionName: "requestWithdrawal",
          args: [parsedAmount],
        });
        const withdrawTx = await walletClient.writeContract(request);

        // 等待交易确认
        const receipt = await publicClient.waitForTransactionReceipt({ hash: withdrawTx });

        // 解析事件日志
        const withdrawalRequestedEvent = receipt.logs
          .map(log => {
            try {
              return decodeEventLog({
                abi: depositWithdrawContract.abi,
                data: log.data,
                topics: log.topics,
              });
            } catch {
              return undefined;
            }
          })
          .find(event => event?.eventName === "WithdrawalRequested");

        if (withdrawalRequestedEvent) {
          const requestId = (withdrawalRequestedEvent.args as any).requestId;
          setWithdrawalRequestId(requestId.toString());

          // 只有在事件确认后，才记录交易
          await fetch("/api/DepositWithdrawal", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              userAddress: address,
              amount: usdtAmount,
              type: "withdraw",
              contractRequestId: requestId.toString(),
              status: "pending",
            }),
          });

          notification.success("提现请求已提交，请等待处理");
        } else {
          throw new Error("未能找到 WithdrawalRequested 事件");
        }
      }

      // 更新余额和刷新交易记录
      await updatePlatformBalance();
      await fetchTransactionRecords();
    } catch (error) {
      console.error("交易失败:", error);
      notification.error("交易失败: " + (error as Error).message);
      // 不记录失败的交易
    } finally {
      setIsLoading(false);
      setUsdtAmount("0");
    }
  }, [
    isConnected,
    depositWithdrawContract,
    walletClient,
    publicClient,
    activeTab,
    usdtAmount,
    address,
    updatePlatformBalance,
    fetchTransactionRecords,
    setWithdrawalRequestId,
  ]);

  const handleMaxClick = useCallback(() => {
    if (activeTab === "deposit") {
      setUsdtAmount(usdtBalance);
    } else {
      setUsdtAmount(availableBalance);
    }
  }, [activeTab, usdtBalance, availableBalance]);
  return (
    <div className="flex flex-col md:flex-row items-start justify-center bg-black text-white p-4 md:p-6 md:mt-10 gap-8">
      <div className="border border-[#424242] bg-base-400 text-white p-6 rounded-lg w-full md:w-1/3">
        <div className="flex space-x-4 mb-6">
          <button
            className={`${
              activeTab === "deposit" ? "text-white border-b-2 border-primary" : "text-gray-400"
            } font-semibold pb-2`}
            onClick={() => setActiveTab("deposit")}
          >
            Deposit
          </button>
          <button
            className={`${
              activeTab === "withdraw" ? "text-white border-b-2 border-primary" : "text-gray-400"
            } font-semibold pb-2`}
            onClick={() => setActiveTab("withdraw")}
          >
            Withdraw
          </button>
        </div>

        <div className="border border-[#424242] bg-base-400 rounded-lg p-4 mb-4">
          <p className="text-gray-400 mb-2">You {activeTab === "deposit" ? "deposit" : "withdraw"}</p>
          <div className="flex justify-between items-center">
            <div className="relative flex items-center w-1/2">
              <div className="absolute left-0 flex items-center h-full">
                <Image src="https://cryptologos.cc/logos/tether-usdt-logo.png" alt="USDT" width={20} height={20} />
              </div>
              <input
                type="text"
                value={usdtAmount}
                onChange={e => setUsdtAmount(e.target.value)}
                className="bg-transparent text-3xl font-bold focus:outline-none w-full pl-8"
              />
            </div>
            <button className="bg-custom-hover text-white px-3 py-2 rounded-lg flex items-center">
              <span className="mr-2">{selectedToken}</span>
              <ChevronDown size={20} />
            </button>
          </div>
          <p className="text-right text-sm text-gray-400 mt-1">
            Balance:{" "}
            {isUsdtBalanceLoading
              ? "Loading..."
              : activeTab === "deposit"
              ? `${usdtBalance} USDT`
              : `${availableBalance} USDT`}{" "}
            <span className="text-primary cursor-pointer" onClick={handleMaxClick}>
              Max
            </span>
          </p>
        </div>

        <div className="flex justify-end items-center mb-4">
          <span className="text-gray-400">Gas: {formatGasPrice()}</span>
        </div>

        <div className="bg-custom-hover rounded-lg p-4 mb-4 flex items-center">
          <Info className="text-gray-400 mr-4" size={20} />
          <p className="text-sm">
            Deposits and withdrawals will affect your level on the platform
            <br />
            <br />
            Total platform margin balance is: {platformBalance} USDT
          </p>
        </div>

        {!isConnected ? (
          <RainbowKitCustomConnectButton />
        ) : (
          <button
            className={`w-full ${
              usdtAmount === "0" ? "bg-custom-hover" : "bg-primary"
            } hover:bg-opacity-80 text-white py-3 rounded-lg font-semibold cursor-pointer transition-colors duration-200`}
            onClick={handleTransaction}
            disabled={usdtAmount === "0" || isLoading || isContractLoading || !depositWithdrawContract}
          >
            {isLoading ? (
              <div className="flex items-center justify-center">
                <div className="w-5 h-5 border-t-2 border-b-2 border-white rounded-full animate-spin mr-2"></div>
                处理中...
              </div>
            ) : (
              <div className="flex items-center justify-center">
                <ClipboardDocumentCheckIcon className="h-5 w-5 mr-2" />
                {activeTab === "deposit" ? "Deposit" : "Withdraw"}
              </div>
            )}
          </button>
        )}
      </div>

      <div className="border border-[#424242] bg-base-400 rounded-xl shadow-lg p-4 w-full md:w-2/3">
        <h2 className="text-lg text-gray-400 mb-4">Transaction Records</h2>
        <div className="border border-[#424242] bg-base-400 rounded-xl shadow-lg px-4 py-6">
          <ul className="space-y-0">
            {transactionRecords.map((record, index) => (
              <li
                key={index}
                className="flex justify-between items-center py-4 border-b border-[#424242] last:border-b-0"
              >
                <span className="text-gray-400 w-1/4">{record.date}</span>
                <span className="text-gray-400 w-1/2 text-right">
                  {record.type.charAt(0).toUpperCase() + record.type.slice(1).toLowerCase()}: {record.amount} USDT
                </span>
                <span
                  className={`w-1/4 text-right ${
                    record.status === "completed" || record.status === "success"
                      ? "text-primary"
                      : record.status === "pending"
                      ? "text-yellow-500"
                      : "text-primary"
                  }`}
                >
                  {record.status === "completed" || record.status === "success"
                    ? "success"
                    : record.status === "pending"
                    ? "pending"
                    : record.status === "failed"
                    ? "fail"
                    : record.status}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default DepositWithdrawalPage;
