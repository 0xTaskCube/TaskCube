"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loading } from "../../../components/ui/Loading";
import { FaPaperPlane, FaXTwitter } from "react-icons/fa6";
import { decodeEventLog } from "viem";
import { useAccount } from "wagmi";
import { usePublicClient, useWalletClient } from "wagmi";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import { BlockieAvatar } from "~~/components/scaffold-eth";
import { OfficialBadge, isOfficialTask } from "~~/components/ui/OfficialTask";
import { useScaffoldContract } from "~~/hooks/scaffold-eth";
import { notification } from "~~/utils/scaffold-eth";

type LevelType = "Initiate" | "Operative" | "Enforcer" | "Vanguard" | "Prime";

interface TaskDetail {
  _id: string;
  title: string;
  description: string;
  creator?: string;
  creatorAddress?: string;
  reward: string;
  startDate: string;
  endDate: string;
  taskType: string;
  participationType: string;
  requirements?: string[];
  participants: Participant[];
  level: LevelType;
  twitterAccount?: string;
  telegramAccount?: string;
  taskCount: string;
  onChainTaskId?: string;
  status?: string;
}

interface Participant {
  address: string;
  status: string;
}

const TaskDetailPage = ({ params }: { params: { taskId: string } }) => {
  const { address } = useAccount();
  const { data: taskRewardContract } = useScaffoldContract({
    contractName: "TaskReward",
  });
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();

  const [isTaskExpired, setIsTaskExpired] = useState(false);
  const [task, setTask] = useState<TaskDetail | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<string>("");
  const [isAccepted, setIsAccepted] = useState(false);
  const [userLevel, setUserLevel] = useState<LevelType>("Initiate");
  const [completedCount, setCompletedCount] = useState(0);
  const [taskCount, setTaskCount] = useState(0);
  const [canWithdraw, setCanWithdraw] = useState(false);
  const [remainingReward, setRemainingReward] = useState("0");
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const participationOptions = [
    { value: "Initiate", label: "Initiate", minReward: 0 },
    { value: "Operative", label: "Operative", minReward: 100 },
    { value: "Enforcer", label: "Enforcer", minReward: 300 },
    { value: "Vanguard", label: "Vanguard", minReward: 500 },
    { value: "Prime", label: "Prime", minReward: 1000 },
  ];
  const getParticipationTypeColor = (type: string): string => {
    switch (type) {
      case "Initiate":
        return "bg-[#0d9488]";
      case "Operative":
        return "bg-[#3498db]";
      case "Enforcer":
        return "bg-[#e74c3c]";
      case "Vanguard":
        return "bg-[#9b59b6]";
      case "Prime":
        return "bg-[#ffd700]";
      default:
        return "bg-gray-700";
    }
  };

  const fetchRemainingReward = async () => {
    try {
      if (!task?.onChainTaskId || !taskRewardContract || !publicClient) {
        return;
      }

      const onChainTask = (await publicClient.readContract({
        address: taskRewardContract.address as `0x${string}`,
        abi: taskRewardContract.abi,
        functionName: "tasks",
        args: [BigInt(task.onChainTaskId)],
      })) as readonly [string, bigint, bigint, bigint, boolean];

      const claimedAmount = await publicClient.readContract({
        address: taskRewardContract.address as `0x${string}`,
        abi: taskRewardContract.abi,
        functionName: "claimedRewards",
        args: [BigInt(task.onChainTaskId)],
      });

      const totalReward = Number(task.reward) * Number(task.taskCount);
      const claimed = Number(claimedAmount) / 1e6;
      const approvedAmount = Number(task.reward) * completedCount;
      const remaining = totalReward - approvedAmount;

      console.log("Calculation of remaining rewards:", {
        totalReward,
        claimedAmount: claimed,
        completedCount,
        approvedAmount,
        remaining,
        taskStatus: onChainTask[4],
      });

      if (!onChainTask[4]) {
        setRemainingReward("0");
      } else {
        setRemainingReward(remaining > 0 ? remaining.toFixed(2) : "0");
      }
    } catch (error) {
      console.error("Failed to obtain remaining rewards:", error);
      setRemainingReward("0");
    }
  };

  useEffect(() => {
    if (task?.onChainTaskId) {
      fetchRemainingReward();
    }
  }, [task, completedCount, taskRewardContract, publicClient]);

  const fetchTask = async () => {
    try {
      console.log("Start getting task data, taskId:", params.taskId);
      const response = await fetch(`/api/task?taskId=${params.taskId}`);
      console.log("API response status:", response.status);
      if (response.ok) {
        const data = await response.json();

        if (!data.task) {
          console.error("Task data is incomplete:", data);
          throw new Error("Task data is incomplete");
        }
        setTask(data.task);
        setParticipants(data.task.participants || []);
        setTaskCount(parseInt(data.task.taskCount) || 0);
        const completed = (data.task.participants || []).filter((p: Participant) => p.status === "approved").length;
        setCompletedCount(completed);
      } else {
        throw new Error("Task not found");
      }
    } catch (error) {
      console.error("Failed to get task details:", error);
      setError("Failed to get task details");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTask();
  }, [params.taskId]);

  useEffect(() => {
    const fetchUserLevel = async () => {
      if (address) {
        try {
          const balanceResponse = await fetch(`/api/DepositWithdrawal?userAddress=${address}&action=getBalance`);
          const balanceData = await balanceResponse.json();

          const invitesResponse = await fetch(`/api/invites?inviter=${address}`);
          const invitesData = await invitesResponse.json();

          if (balanceData.success && invitesData.invites) {
            const balance = parseFloat(balanceData.availableBalance);

            // Uses the same level calculation logic as the dashboard
            let level: LevelType = "Initiate";
            if (balance >= 1000) {
              level = "Operative";
            }
            if (balance >= 3000) {
              level = "Enforcer";
            }

            // Check for Vanguard level
            const vanguardInvites = invitesData.invites.filter((invite: any) => parseFloat(invite.balance) >= 1000);
            if (balance >= 3000 && vanguardInvites.length >= 11) {
              level = "Vanguard";
            }

            // Check for Prime level
            const primeInvites = invitesData.invites.filter((invite: any) => parseFloat(invite.balance) >= 1000);
            if (balance >= 3000 && primeInvites.length >= 120) {
              level = "Prime";
            }

            setUserLevel(level);
          }
        } catch (error) {
          console.error("Failed to obtain user level:", error);
        }
      }
    };

    fetchUserLevel();
  }, [address]);

  useEffect(() => {
    if (task && address) {
      const userAccepted = task.participants.some(p => p.address === address);
      setIsAccepted(userAccepted);
    }
  }, [task, address]);

  useEffect(() => {
    const checkWithdrawable = () => {
      if (task && address) {
        const isCreator = task.creatorAddress === address;
        const isEnded = isTaskExpired || completedCount >= taskCount;
        const hasRemaining = completedCount < parseInt(task.taskCount);

        console.log("Check redemption conditions:", {
          isCreator,
          isEnded,
          hasRemaining,
          completedCount,
          taskCount,
          reward: task.reward,
        });

        if (isCreator && isEnded && hasRemaining) {
          setCanWithdraw(true);
        } else {
          setCanWithdraw(false);
        }
      }
    };

    checkWithdrawable();
  }, [task, address, isTaskExpired, completedCount, taskCount]);

  useEffect(() => {
    const calculateTimeRemaining = () => {
      if (task) {
        const now = new Date();
        const endDate = new Date(task.endDate);
        const timeDiff = endDate.getTime() - now.getTime();

        if (timeDiff <= 0) {
          setTimeRemaining("Task ended");
          setIsTaskExpired(true);
        } else {
          const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
          const hours = Math.floor((timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

          let remainingText = "";
          if (days > 0) {
            remainingText += `${days} day${days > 1 ? "s" : ""} `;
          }
          if (hours > 0 || days > 0) {
            remainingText += `${hours} hour${hours !== 1 ? "s" : ""}`;
          }

          setTimeRemaining(remainingText.trim());
          setIsTaskExpired(false);
        }
      }
    };

    calculateTimeRemaining();
    const timer = setInterval(calculateTimeRemaining, 60000);

    return () => clearInterval(timer);
  }, [task]);

  const router = useRouter();
  const handleAcceptTask = async () => {
    if (!address) {
      notification.error("Please connect the wallet first");
      return;
    }

    try {
      const response = await fetch("/api/task", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ taskId: params.taskId, address }),
      });

      if (response.ok) {
        setIsAccepted(true);
        notification.success("Task accepted successfully");

        await fetchTask();

        router.push("/task/my-tasks");
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to accept the task");
      }
    } catch (error) {
      console.error("Failed to accept the task:", error);
      notification.error("Failed to accept the task");
    }
  };

  const handleWithdraw = async () => {
    if (!task?.onChainTaskId) {
      notification.error("The task ID on the chain does not exist");
      return;
    }

    if (!taskRewardContract || !walletClient || !publicClient) {
      notification.error("The contract or wallet is not connected");
      return;
    }

    setIsWithdrawing(true);
    try {
      const claimedAmount = await publicClient.readContract({
        address: taskRewardContract.address as `0x${string}`,
        abi: taskRewardContract.abi,
        functionName: "claimedRewards",
        args: [BigInt(task.onChainTaskId)],
      });

      console.log("Pre-withdrawal data:", {
        taskId: task.onChainTaskId,
        reward: task.reward,
        taskCount: task.taskCount,
        totalReward: Number(task.reward) * Number(task.taskCount),
        remainingReward,
        claimedAmount: claimedAmount.toString(),
      });

      const { request } = await publicClient.simulateContract({
        account: address,
        address: taskRewardContract.address as `0x${string}`,
        abi: taskRewardContract.abi,
        functionName: "withdrawTaskRemaining",
        args: [BigInt(task.onChainTaskId)],
      });

      const hash = await walletClient.writeContract(request);
      notification.info("Transaction submitted");

      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      if (receipt.status === "success") {
        notification.success("success");

        await fetchTask();

        await fetchRemainingReward();
      } else {
        throw new Error("Transaction failed");
      }
    } catch (error) {
      console.error("Redemption failed:", error);
      notification.error("Redemption failed: " + (error instanceof Error ? error.message : String(error)));
    } finally {
      setIsWithdrawing(false);
    }
  };

  const canAcceptTask = () => {
    if (!task || !address) return false;

    if (task.creatorAddress === address) {
      return false;
    }

    if (completedCount >= taskCount) {
      return false;
    }

    const levelOrder = ["Initiate", "Operative", "Enforcer", "Vanguard", "Prime"];
    const userLevelIndex = levelOrder.indexOf(userLevel);
    const taskLevelIndex = levelOrder.indexOf(task.participationType as LevelType);

    console.log("userLevel:", userLevel);
    console.log("TaskLevel:", task.participationType);
    console.log("userLevelIndex:", userLevelIndex);
    console.log("taskLevelIndex:", taskLevelIndex);

    return userLevelIndex >= taskLevelIndex;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="bg-base-400 p-8 rounded-lg">
          <Loading size="lg" color="primary" />
        </div>
      </div>
    );
  }
  if (error) return <div className="p-4">Error: {error}</div>;
  if (!task) return <div className="p-4">Task not found</div>;

  return (
    <div className="bg-black text-white p-4 sm:p-6 mt-4 sm:mt-6">
      <div className="max-w-8xl mx-auto">
        <Link href="/task" className="inline-block mb-4 sm:mb-6">
          <ArrowLeftIcon className="h-6 w-6 text-white hover:text-primary" />
        </Link>
        <div className="flex flex-col lg:flex-row">
          
          <div className="w-full lg:w-3/5 lg:pr-6 mb-6 lg:mb-0">
            <div className="border border-[#424242] bg-base-400  rounded-lg p-4 sm:p-6">
              <div className="flex items-center mb-4 sm:mb-6">
                {task.creatorAddress ? (
                  <BlockieAvatar address={task.creatorAddress} size={48} />
                ) : (
                  <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gray-600 rounded-full flex items-center justify-center">
                    <span className="text-xl sm:text-2xl">{task.title.charAt(0).toUpperCase()}</span>
                  </div>
                )}
                <div className="ml-4">
                  <h1 className="text-xl sm:text-2xl font-bold flex items-center">
                    {task.title}
                    {task.creatorAddress && isOfficialTask(task.creatorAddress) && <OfficialBadge />}
                  </h1>
                  <div className="flex items-center mt-1">
                    <p className="text-sm sm:text-base text-gray-400">
                      Create by{" "}
                      {task.creatorAddress
                        ? `${task.creatorAddress.slice(0, 6)}...${task.creatorAddress.slice(-4)}`
                        : "Unknown creator"}{" "}
                    </p>
                    <div className="flex gap-3 ml-4">
                      {task.twitterAccount && (
                        <div
                          className="tooltip tooltip-custom before:!bg-[#424242] before:!text-white before:cursor-pointer before:!whitespace-normal"
                          data-tip={task.twitterAccount}
                          onClick={e => {
                            if ((e.target as HTMLElement).tagName !== "svg") {
                              navigator.clipboard.writeText(task.twitterAccount || "");
                              notification.success("Copied");
                            }
                          }}
                        >
                          <FaXTwitter className="text-xl text-white cursor-pointer hover:text-white" />
                        </div>
                      )}
                      {task.telegramAccount && (
                        <div
                          className="tooltip tooltip-custom before:!bg-[#424242] before:!text-white before:cursor-pointer before:!whitespace-normal"
                          data-tip={task.telegramAccount}
                          onClick={e => {
                            if ((e.target as HTMLElement).tagName !== "svg") {
                              navigator.clipboard.writeText(task.telegramAccount || "");
                              notification.success("Copied");
                            }
                          }}
                        >
                          <FaPaperPlane className="text-xl text-white cursor-pointer hover:text-white" />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              <div className="mb-6">
                <p className="text-sm text-gray-400 mb-2">
                  Task Progress: {completedCount} / {taskCount}
                </p>
                <progress
                  className="progress progress-primary w-full"
                  value={completedCount}
                  max={taskCount || 1}
                ></progress>
              </div>
              <div className="mb-4 sm:mb-6">
                <h2 className="text-lg sm:text-xl font-semibold mb-2">Details</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  {
                    title: "Created By",
                    content: task.creatorAddress
                      ? `${task.creatorAddress.slice(0, 6)}...${task.creatorAddress.slice(-4)}`
                      : "Unknown",
                  },
                  {
                    title: "Reward",
                    content: (
                      <div className="flex items-center">
                        <Image
                          src="https://cryptologos.cc/logos/tether-usdt-logo.png"
                          alt="USDT"
                          width={20}
                          height={20}
                          className="mr-2"
                        />
                        <span>{task.reward} USDT</span>
                      </div>
                    ),
                  },
                  {
                    title: "Participation Level",
                    content: (
                      <div className="flex items-center">
                        <span
                          className={`${getParticipationTypeColor(
                            task.participationType,
                          )} text-white px-2 py-1 rounded text-sm`}
                        >
                          {participationOptions.find(option => option.value === task.participationType)?.label ||
                            "Unknown"}
                        </span>
                      </div>
                    ),
                  },
                  {
                    title: "Time Remaining",
                    content: (
                      <div className="flex items-center">
                        <div
                          className={`w-2 h-2 rounded-full mr-2 ${
                            isTaskExpired ? "bg-red-500" : "bg-green-500 animate-pulse"
                          }`}
                        ></div>
                        <span>{timeRemaining}</span>
                      </div>
                    ),
                  },
                  {
                    title: "Start Date",
                    content: new Date(task.startDate).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    }),
                  },
                  {
                    title: "End Date",
                    content: new Date(task.endDate).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    }),
                  },
                ].map((item, index) => (
                  <div
                    key={index}
                    className="p-4 border rounded-xl border-[#424242] bg-base-400 flex flex-col justify-between h-[100px]"
                  >
                    <h3 className="text-sm text-gray-400">{item.title}</h3>
                    <p className="text-sm sm:text-base text-white">{item.content}</p>
                  </div>
                ))}
              </div>
              <div className="my-6 sm:mb-6">
                <h2 className="text-lg sm:text-xl font-semibold mb-2">Action Details</h2>
              </div>
              <div className="border rounded-xl mt-4 border-[#424242] bg-base-400  text-sm sm:text-base text-white p-4">
                {task.description}
              </div>
              <button
                className={`w-full ${
                  isTaskExpired || isAccepted || !canAcceptTask() ? "bg-custom-hover" : "bg-primary"
                } hover:bg-opacity-80 text-white py-3 rounded-lg font-semibold cursor-pointer transition-colors duration-200 mt-4`}
                onClick={handleAcceptTask}
                disabled={isTaskExpired || isAccepted || !canAcceptTask()}
              >
                {isTaskExpired
                  ? "Ended"
                  : isAccepted
                  ? "Accepted"
                  : task.creatorAddress === address
                  ? "Unable to accept one's own tasks"
                  : completedCount >= taskCount
                  ? "Task ended"
                  : canAcceptTask()
                  ? "Accept task"
                  : `Level ${task.participationType} is required to accept this task`}
              </button>
              {canWithdraw && (
                <button
                  className={`w-full ${
                    isWithdrawing || remainingReward === "0"
                      ? "bg-custom-hover cursor-not-allowed"
                      : "bg-primary hover:bg-opacity-80"
                  } text-white py-3 rounded-lg font-semibold mt-4`}
                  onClick={handleWithdraw}
                  disabled={isWithdrawing || remainingReward === "0"}
                >
                  {isWithdrawing ? (
                    <div className="flex items-center justify-center">
                      <Loading size="sm" className="mr-2" />
                      Redeeming...
                    </div>
                  ) : (
                    `Redeem (${remainingReward} USDT)`
                  )}
                </button>
              )}
            </div>
          </div>

          <div className="w-full lg:w-2/5">
            <div className="border rounded-xl border-[#424242] bg-base-400 p-4 sm:p-6">
              <h2 className="text-lg sm:text-xl font-semibold mb-4">Participants</h2>
              <div className="flex text-sm justify-between text-gray-400 mb-2">
                <span className="w-16">Position</span>
                <span>Address</span>
              </div>
              <div className="space-y-4 ">
                {participants.map((participant, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div className="w-16 flex items-center">
                      <span className="text-sm">{index + 1}</span>
                    </div>
                    <div className="flex items-center">
                      <BlockieAvatar address={participant.address} size={24} />
                      <span className="ml-2 text-sm">{`${participant.address.slice(0, 6)}...${participant.address.slice(
                        -4,
                      )}`}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TaskDetailPage;
