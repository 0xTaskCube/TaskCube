"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Loading } from "./Loading";
import { decodeEventLog, parseUnits } from "viem";
import { formatUnits } from "viem";
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
  const formatAmount = (amount: string | number) => {
    const num = Number(amount);
    return isNaN(num) ? "0.00" : num.toFixed(2);
  };
  const [loading, setLoading] = useState(false);
  const [claimAmount, setClaimAmount] = useState("");
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();
  const [gasPrice, setGasPrice] = useState<bigint | null>(null);

  const { data: taskRewardContract, isLoading: isContractLoading } = useScaffoldContract({
    contractName: "TaskReward",
    walletClient,
  });

  useEffect(() => {
    const fetchGasPrice = async () => {
      if (!publicClient) return;
      try {
        const fetchedGasPrice = await publicClient.getGasPrice();
        setGasPrice(fetchedGasPrice);
      } catch (error) {
        console.error("Error fetching gas price:", error);
      }
    };

    fetchGasPrice();
    const interval = setInterval(fetchGasPrice, 60000);
    return () => clearInterval(interval);
  }, [publicClient]);


  const formatGasPrice = () => {
    if (!gasPrice) return "Loading...";
    return `~${formatUnits(gasPrice, 18)} ETH`;
  };

  useEffect(() => {
    if (walletClient && taskRewardContract && address) {
      walletClient.getAddresses().catch((error: Error) => {
        console.debug(" walletClient fail:", error);
      });
    }
  }, [walletClient, taskRewardContract, address]);

  const handleClaimSubmit = async () => {
    if (!isConnected || !address) {
      notification.error("Please connect the wallet");
      return;
    }
    const formattedAvailableAmount = formatAmount(availableAmount);
    if (Number(claimAmount) > Number(formattedAvailableAmount)) {
      notification.error(`The amount that can be claimed cannot exceed ${formattedAvailableAmount} USDT`);
      return;
    }
    setLoading(true);

    try {
      if (!taskRewardContract || !walletClient || !publicClient) {
        throw new Error("The contract or wallet is not ready");
      }

      const parsedAmount = parseUnits(claimAmount, 6);
      console.log("type:", type);
      console.log("availableAmount:", availableAmount);
      console.log("claimAmount:", claimAmount);
      console.log("Submit application parameters:", {
        type,
        bountyId,
        availableAmount,
        claimAmount,
      });
      if (type === "task") {
        try {
          if (!taskRewardContract || !walletClient || !publicClient) {
            throw new Error("The contract or wallet is not ready");
          }

          const parsedAmount = parseUnits(claimAmount, 6);
          console.log("Submit application parameters:", {
            type,
            bountyId: "task",
            claimAmount,
            parsedAmount,
          });

          const { request } = await publicClient.simulateContract({
            account: address,
            address: taskRewardContract.address,
            abi: taskRewardContract.abi,
            functionName: "submitClaim",
            args: [BigInt(0), parsedAmount],
          });

          const claimTx = await walletClient.writeContract(request);
          console.log("Claim Transaction sented:", claimTx);

          const receipt = await publicClient.waitForTransactionReceipt({ hash: claimTx });
          console.log("Claim Transaction confirmed:", receipt);

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
            throw new Error("failed to obtain ClaimId");
          }

          console.log("Claiming...");
          const executeTx = await walletClient.writeContract({
            account: address,
            address: taskRewardContract.address,
            abi: taskRewardContract.abi,
            functionName: "executeClaim",
            args: [BigInt(claimId)],
          });

          console.log("Execute Transaction sented:", executeTx);
          const executeReceipt = await publicClient.waitForTransactionReceipt({ hash: executeTx });
          console.log("Execute Transaction confirmed:", executeReceipt);

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
            throw new Error(errorData.message || "Failed to save record");
          }

          notification.success("Reward successfully!");
          setClaimAmount("");
          onClose();
        } catch (error) {
          console.error("Failed to collect:", error);
          notification.error("Failed to collect: " + (error instanceof Error ? error.message : String(error)));
          throw error;
        }
      } else {
        if (Number(availableAmount) < Number(claimAmount)) {
          throw new Error(`Insufficient balance, Currently available: ${availableAmount} USDT`);
        }

        const { request } = await publicClient.simulateContract({
          account: address,
          address: taskRewardContract.address,
          abi: taskRewardContract.abi,
          functionName: "submitClaim",
          args: [BigInt(0), parsedAmount],
        });

        const claimTx = await walletClient.writeContract(request);
        console.log("Invitation rewards Claim Transaction sented:", claimTx);

        const receipt = await publicClient.waitForTransactionReceipt({ hash: claimTx });
        console.log("Invitation rewards Claim Transaction confirmed:", receipt);

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
          throw new Error("Failed to obtain invitation rewards ClaimId");
        }

        console.log("Claiming...");
        const executeTx = await walletClient.writeContract({
          account: address,
          address: taskRewardContract.address,
          abi: taskRewardContract.abi,
          functionName: "executeClaim",
          args: [BigInt(claimId)],
        });

        const executeReceipt = await publicClient.waitForTransactionReceipt({ hash: executeTx });

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
          throw new Error(errorData.message || "Failed to save invitation reward record");
        }

        notification.success("The invitation reward was collected successfully!");
        setClaimAmount("");
        onClose();
      }
    } catch (error) {
      console.error("Failed to collect:", error);
      notification.error("Failed to collect: " + (error instanceof Error ? error.message : String(error)));
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

        <h3 className="text-xl font-bold mb-6 text-white">Claim rewards</h3>

        <div className="space-y-4">
          <div className="border border-[#424242] bg-black rounded-lg p-4">
            <span className="text-sm text-gray-400">Amount:</span>
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
                placeholder="Enter the quantity to receive"
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
              <span>Gas Price: {formatGasPrice()}</span>
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
                  Loading...
                </div>
              ) : (
                <div className="flex items-center justify-center">
                  <ClipboardDocumentCheckIcon className="h-5 w-5 mr-2" />
                  Claim
                </div>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
