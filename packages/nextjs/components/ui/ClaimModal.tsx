"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Loading } from "./Loading";
import { decodeEventLog, parseUnits } from "viem";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";
import { ClipboardDocumentCheckIcon } from "@heroicons/react/24/outline";
import { useScaffoldContract } from "~~/hooks/scaffold-eth";
import { notification } from "~~/utils/scaffold-eth";

interface ClaimModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableAmount: string; // 从父组件传入的余额
  bountyId: string;
  type?: "task" | "invite";
}

export const ClaimModal: React.FC<ClaimModalProps> = ({
  isOpen,
  onClose,
  availableAmount,
  bountyId,
  type = "task",
}) => {
  // 在这里添加格式化函数
  const formatAmount = (amount: string | number) => {
    const num = Number(amount);
    return isNaN(num) ? "0.00" : num.toFixed(2);
  };
  const [loading, setLoading] = useState(false);
  const [claimAmount, setClaimAmount] = useState("");
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();

  const { data: taskRewardContract, isLoading: isContractLoading } = useScaffoldContract({
    contractName: "TaskReward",
    walletClient,
  });

  // 添加预热效果
  useEffect(() => {
    if (walletClient && taskRewardContract && address) {
      // 预热 walletClient
      walletClient.getAddresses().catch((error: Error) => {
        console.debug("预热 walletClient 失败:", error);
      });
    }
  }, [walletClient, taskRewardContract, address]);

  const handleClaimSubmit = async () => {
    if (!isConnected || !address) {
      notification.error("请先连接钱包");
      return;
    }
    const formattedAvailableAmount = formatAmount(availableAmount);
    if (Number(claimAmount) > Number(formattedAvailableAmount)) {
      notification.error(`可领取金额不能超过 ${formattedAvailableAmount} USDT`);
      return;
    }
    setLoading(true);

    try {
      if (!taskRewardContract || !walletClient || !publicClient) {
        throw new Error("合约或钱包未准备好");
      }

      const parsedAmount = parseUnits(claimAmount, 6);
      console.log("当前类型:", type);
      console.log("可用金额:", availableAmount);
      console.log("领取金额:", claimAmount);
      console.log("提交申请参数:", {
        type,
        bountyId,
        availableAmount,
        claimAmount,
      });
      if (type === "task") {
        // 移除任务信息获取的逻辑，直接提交申请
        try {
          if (!taskRewardContract || !walletClient || !publicClient) {
            throw new Error("合约或钱包未准备好");
          }

          const parsedAmount = parseUnits(claimAmount, 6);
          console.log("提交申请参数:", {
            type,
            bountyId: "task", // 使用固定值
            claimAmount,
            parsedAmount,
          });

          // 直接调用合约的 submitClaim 方法
          const { request } = await publicClient.simulateContract({
            account: address,
            address: taskRewardContract.address,
            abi: taskRewardContract.abi,
            functionName: "submitClaim",
            args: [BigInt(0), parsedAmount], // 使用 0 作为 taskId
          });

          const claimTx = await walletClient.writeContract(request);
          console.log("Claim 交易已发送:", claimTx);

          const receipt = await publicClient.waitForTransactionReceipt({ hash: claimTx });
          console.log("Claim 交易已确认:", receipt);

          // 从事件中获取 claimId
          let claimId = "";
          for (const log of receipt.logs) {
            try {
              const event = decodeEventLog({
                abi: taskRewardContract.abi,
                data: log.data,
                topics: log.topics,
              });
              if (event.eventName === "ClaimSubmitted") {
                claimId = event.args.claimId.toString();
                break;
              }
            } catch {
              continue;
            }
          }

          if (!claimId) {
            throw new Error("未能获取到 ClaimId");
          }

          // 直接执行 Claim
          console.log("开始执行 Claim...");
          const executeTx = await walletClient.writeContract({
            account: address,
            address: taskRewardContract.address,
            abi: taskRewardContract.abi,
            functionName: "executeClaim",
            args: [BigInt(claimId)],
          });

          console.log("Execute 交易已发送:", executeTx);
          const executeReceipt = await publicClient.waitForTransactionReceipt({ hash: executeTx });
          console.log("Execute 交易已确认:", executeReceipt);

          // 保存记录到数据库
          const saveResponse = await fetch("/api/claims", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              userAddress: address,
              amount: claimAmount,
              bountyId: "task",
              taskId: "0",
              contractRequestId: claimId,
              status: "executed",
              transactionHash: receipt.transactionHash,
              executeTransactionHash: executeReceipt.transactionHash,
              type: "task",
              relatedTasks: [
                {
                  taskId: "0",
                  amount: claimAmount,
                  type: "task",
                },
              ],
            }),
          });

          if (!saveResponse.ok) {
            const errorData = await saveResponse.json();
            throw new Error(errorData.message || "保存记录失败");
          }

          notification.success("奖励领取成功！");
          setClaimAmount("");
          onClose();
        } catch (error) {
          console.error("领取失败:", error);
          notification.error("领取失败: " + (error instanceof Error ? error.message : String(error)));
          throw error; // 继续抛出错误，让外层的 catch 处理
        }
      } else {
        // 邀请奖励处理逻辑
        console.log("开始处理邀请奖励...");
        if (Number(availableAmount) < Number(claimAmount)) {
          throw new Error(`可用余额不足，当前邀请奖励可用余额: ${availableAmount} USDT`);
        }

        // 提交 Claim
        const { request } = await publicClient.simulateContract({
          account: address,
          address: taskRewardContract.address,
          abi: taskRewardContract.abi,
          functionName: "submitClaim",
          args: [BigInt(0), parsedAmount],
        });

        const claimTx = await walletClient.writeContract(request);
        console.log("邀请奖励 Claim 交易已发送:", claimTx);

        const receipt = await publicClient.waitForTransactionReceipt({ hash: claimTx });
        console.log("邀请奖励 Claim 交易已确认:", receipt);

        // 获取 claimId
        let claimId = "";
        for (const log of receipt.logs) {
          try {
            const event = decodeEventLog({
              abi: taskRewardContract.abi,
              data: log.data,
              topics: log.topics,
            });
            if (event.eventName === "ClaimSubmitted") {
              claimId = event.args.claimId.toString();
              break;
            }
          } catch {
            continue;
          }
        }

        if (!claimId) {
          throw new Error("未能获取到邀请奖励的 ClaimId");
        }

        // 执行 Claim
        console.log("开始执行邀请奖励 Claim...");
        const executeTx = await walletClient.writeContract({
          account: address,
          address: taskRewardContract.address,
          abi: taskRewardContract.abi,
          functionName: "executeClaim",
          args: [BigInt(claimId)],
        });

        console.log("邀请奖励 Execute 交易已发送:", executeTx);
        const executeReceipt = await publicClient.waitForTransactionReceipt({ hash: executeTx });
        console.log("邀请奖励 Execute 交易已确认:", executeReceipt);

        // 保存记录
        const saveResponse = await fetch("/api/claims", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            userAddress: address,
            amount: claimAmount,
            bountyId: "invite",
            taskId: "0",
            contractRequestId: claimId,
            status: "executed",
            transactionHash: receipt.transactionHash,
            executeTransactionHash: executeReceipt.transactionHash,
            type: "invite",
            relatedTasks: [
              {
                taskId: "0",
                amount: claimAmount,
                type: "invite",
              },
            ],
          }),
        });

        if (!saveResponse.ok) {
          const errorData = await saveResponse.json();
          throw new Error(errorData.message || "保存邀请奖励记录失败");
        }

        notification.success("邀请奖励领取成功！");
        setClaimAmount("");
        onClose();
      }
    } catch (error) {
      console.error("领取失败:", error);
      notification.error("领取失败: " + (error instanceof Error ? error.message : String(error)));
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-base-300 rounded-lg p-6 w-96 relative">
        <button onClick={onClose} className="absolute right-3 top-3 text-gray-400 hover:text-white">
          ✕
        </button>

        <h3 className="text-xl font-bold mb-6 text-white">领取奖励</h3>

        <div className="space-y-4">
          <div className="border border-[#424242] bg-black rounded-lg p-4">
            <span className="text-sm text-gray-400">可领取金额:</span>
            <span className="text-white ml-2 text-lg font-semibold">{formatAmount(availableAmount)} USDT</span>
          </div>

          <div className="space-y-4">
            <div className="relative">
              <Image
                src="https://cryptologos.cc/logos/tether-usdt-logo.png"
                alt="USDT"
                width={20}
                height={20}
                className="absolute left-3 top-1/2 transform -translate-y-1/2"
              />
              <input
                type="number"
                placeholder="输入领取数量"
                value={claimAmount}
                onChange={e => setClaimAmount(e.target.value)}
                className="w-full bg-black text-white pl-10 pr-20 py-3 rounded-lg border border-[#424242] focus:outline-none focus:ring-2 focus:ring-primary [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                onWheel={e => e.currentTarget.blur()}
              />
              <button
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-primary text-sm hover:text-primary-focus"
                onClick={() => setClaimAmount(formatAmount(availableAmount))}
              >
                MAX
              </button>
            </div>

            <div className="flex justify-between items-center text-sm text-gray-400 px-2">
              <span>Gas Price: ~0.001 ETH</span>
            </div>

            <button
              className={`w-full py-3 rounded-lg font-semibold ${
                loading ||
                !claimAmount ||
                Number(claimAmount) <= 0 ||
                Number(claimAmount) > Number(formatAmount(availableAmount))
                  ? "bg-black text-white cursor-not-allowed"
                  : "bg-primary hover:bg-opacity-80 text-white"
              }`}
              onClick={handleClaimSubmit}
              disabled={
                loading ||
                !claimAmount ||
                Number(claimAmount) <= 0 ||
                Number(claimAmount) > Number(formatAmount(availableAmount))
              }
            >
              {loading ? (
                <div className="flex items-center justify-center">
                  <Loading size="sm" color="primary" className="mr-2" />
                  处理中...
                </div>
              ) : (
                <div className="flex items-center justify-center">
                  <ClipboardDocumentCheckIcon className="h-5 w-5 mr-2" />
                  提交申请
                </div>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
