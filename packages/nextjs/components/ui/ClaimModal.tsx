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
  availableAmount: string;
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

    setLoading(true);

    try {
      if (!taskRewardContract || !walletClient || !publicClient) {
        console.error("合约或钱包未准备好");
        throw new Error("合约或钱包未准备好");
      }

      const parsedAmount = parseUnits(claimAmount, 6);

      if (type === "task") {
        // 任务奖励处理逻辑
        if (!bountyId) {
          throw new Error("找不到任务ID");
        }

        console.log("开始获取任务信息...");
        const response = await fetch(`/api/task?taskId=${bountyId}`);
        const data = await response.json();
        console.log("获取到的任务信息:", data);

        if (!data.task) {
          throw new Error("找不到任务信息");
        }

        const onChainTaskId = data.task.onChainTaskId;
        if (!onChainTaskId) {
          throw new Error("找不到链上任务ID");
        }

        // 调用合约提交申领
        const { request } = await publicClient.simulateContract({
          account: address,
          address: taskRewardContract.address,
          abi: taskRewardContract.abi,
          functionName: "submitClaim",
          args: [BigInt(onChainTaskId), parsedAmount],
        });

        const claimTx = await walletClient.writeContract(request);
        const receipt = await publicClient.waitForTransactionReceipt({ hash: claimTx });

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

        // 保存申领记录到数据库
        const saveResponse = await fetch("/api/claims", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            userAddress: address,
            amount: claimAmount,
            bountyId: type === "task" ? bountyId : "invite",
            taskId: onChainTaskId.toString(), // 使用相同的 onChainTaskId
            contractRequestId: claimId,
            status: "pending",
            transactionHash: receipt.transactionHash,
            type: type, // 区分任务类型
          }),
        });

        if (!saveResponse.ok) {
          const errorData = await saveResponse.json();
          throw new Error(errorData.message || "保存申请记录失败");
        }

        const saveResult = await saveResponse.json();
        if (!saveResult.success) {
          throw new Error(saveResult.message || "保存申请记录失败");
        }
      } else {
        // 邀请奖励处理逻辑
        // 使用 taskId 0 表示邀请奖励
        const { request } = await publicClient.simulateContract({
          account: address,
          address: taskRewardContract.address,
          abi: taskRewardContract.abi,
          functionName: "submitClaim",
          args: [BigInt(0), parsedAmount],
        });

        const claimTx = await walletClient.writeContract(request);
        const receipt = await publicClient.waitForTransactionReceipt({ hash: claimTx });

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

        // 保存申领记录到数据库
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
            status: "pending",
            transactionHash: receipt.transactionHash,
            type: "invite",
          }),
        });

        if (!saveResponse.ok) {
          const errorData = await saveResponse.json();
          throw new Error(errorData.message || "保存申请记录失败");
        }

        const saveResult = await saveResponse.json();
        if (!saveResult.success) {
          throw new Error(saveResult.message || "保存申请记录失败");
        }
      }

      notification.success("申请提交成功，等待管理员审批");
      setClaimAmount("");
      onClose();
    } catch (error) {
      console.error("提交申请失败:", error);
      notification.error("提交失败: " + (error instanceof Error ? error.message : String(error)));
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
            <span className="text-white ml-2 text-lg font-semibold">{availableAmount} USDT</span>
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
                onClick={() => setClaimAmount(availableAmount)}
              >
                MAX
              </button>
            </div>

            <div className="flex justify-between items-center text-sm text-gray-400 px-2">
              <span>Gas Price: ~0.001 ETH</span>
            </div>

            <button
              className={`w-full py-3 rounded-lg font-semibold ${
                loading || !claimAmount || Number(claimAmount) <= 0 || Number(claimAmount) > Number(availableAmount)
                  ? "bg-black text-white cursor-not-allowed"
                  : "bg-primary hover:bg-opacity-80 text-white"
              }`}
              onClick={handleClaimSubmit}
              disabled={
                loading || !claimAmount || Number(claimAmount) <= 0 || Number(claimAmount) > Number(availableAmount)
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
