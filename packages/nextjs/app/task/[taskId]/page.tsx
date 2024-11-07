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

  // 现有的状态声明
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
        return "bg-[#0d9488]"; // 绿色
      case "Operative":
        return "bg-[#3498db]"; // 蓝色
      case "Enforcer":
        return "bg-[#e74c3c]"; // 橙色
      case "Vanguard":
        return "bg-[#9b59b6]"; // 紫色
      case "Prime":
        return "bg-[#ffd700]"; // 金色
      default:
        return "bg-gray-700"; // 保留默认颜色为深灰色
    }
  };

  // 使用现有的 getBounty API 获取剩余奖励
  const fetchRemainingReward = async () => {
    try {
      // 直接使用任务的原始数据计算
      if (task) {
        const totalReward = Number(task.reward) * Number(task.taskCount);
        const completedReward = completedCount * Number(task.reward);
        const remaining = totalReward - completedReward;
        setRemainingReward(remaining.toFixed(2));
      }
    } catch (error) {
      console.error("获取剩余奖励失败:", error);
    }
  };

  useEffect(() => {
    if (task?.onChainTaskId && completedCount !== undefined) {
      fetchRemainingReward();
    }
  }, [task, completedCount]);

  const fetchTask = async () => {
    try {
      console.log("开始获取任务数据，taskId:", params.taskId);
      const response = await fetch(`/api/task?taskId=${params.taskId}`);
      console.log("API 响应状态:", response.status);
      if (response.ok) {
        const data = await response.json();
        console.log("获取到的任务数据:", data);
        if (!data.task) {
          console.error("任务数据不完整:", data);
          throw new Error("任务数据不完整");
        }
        setTask(data.task); // 注意这里，确保使用 data.task
        setParticipants(data.task.participants || []);
        setTaskCount(parseInt(data.task.taskCount) || 0);
        const completed = (data.task.participants || []).filter((p: Participant) => p.status === "approved").length;
        setCompletedCount(completed);
      } else {
        throw new Error("Task not found");
      }
    } catch (error) {
      console.error("获取任务详情失败:", error);
      setError("获取任务详情失败");
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
          // 获取用户余额
          const balanceResponse = await fetch(`/api/DepositWithdrawal?userAddress=${address}&action=getBalance`);
          const balanceData = await balanceResponse.json();

          // 获取邀请信息
          const invitesResponse = await fetch(`/api/invites?inviter=${address}`);
          const invitesData = await invitesResponse.json();

          if (balanceData.success && invitesData.invites) {
            const balance = parseFloat(balanceData.availableBalance);

            // 使用与 dashboard 相同的等级计算逻辑
            let level: LevelType = "Initiate";
            if (balance >= 500) {
              level = "Operative";
            }
            if (balance >= 1000) {
              level = "Enforcer";
            }

            // Check for Vanguard level
            const vanguardInvites = invitesData.invites.filter((invite: any) => parseFloat(invite.balance) >= 100);
            if (balance >= 2000 && vanguardInvites.length >= 1) {
              level = "Vanguard";
            }

            // Check for Prime level
            const primeInvites = invitesData.invites.filter((invite: any) => parseFloat(invite.balance) >= 500);
            if (balance >= 3000 && primeInvites.length >= 2) {
              level = "Prime";
            }

            setUserLevel(level);
          }
        } catch (error) {
          console.error("获取用户等级失败:", error);
        }
      }
    };

    fetchUserLevel();
  }, [address]);

  useEffect(() => {
    // 检查当前用户是否已经接受了这个任务
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

        console.log("检查赎回条件:", {
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
    const timer = setInterval(calculateTimeRemaining, 60000); // 每分钟更新一次

    return () => clearInterval(timer);
  }, [task]);

  const router = useRouter();
  const handleAcceptTask = async () => {
    if (!address) {
      notification.error("请先连接钱包");
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
        notification.success("任务接受成功");
        // 重新获取任务详情以更新参与者列表
        await fetchTask();
        // 跳转到"我的任务"页面
        router.push("/task/my-tasks");
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || "接受任务失败");
      }
    } catch (error) {
      console.error("接受任务失败:", error);
      notification.error("接受任务失败");
    }
  };

  const handleWithdraw = async () => {
    if (!task?.onChainTaskId) {
      notification.error("链上任务ID不存在");
      return;
    }

    if (!taskRewardContract || !walletClient || !publicClient) {
      notification.error("合约或钱包未连接");
      return;
    }

    setIsWithdrawing(true);
    try {
      // 先获取已领取的奖励金额
      const claimedAmount = await publicClient.readContract({
        address: taskRewardContract.address as `0x${string}`,
        abi: taskRewardContract.abi,
        functionName: "claimedRewards", 
        args: [BigInt(task.onChainTaskId)],
      });

      // 打印调试信息
      // 添加在这里，在模拟交易之前
      console.log("提现前数据:", {
        taskId: task.onChainTaskId,
        reward: task.reward,
        taskCount: task.taskCount,
        totalReward: Number(task.reward) * Number(task.taskCount),
        remainingReward,
        claimedAmount: claimedAmount.toString(),
      });

      // 模拟交易以检查是否会成功
      const { request } = await publicClient.simulateContract({
        account: address,
        address: taskRewardContract.address as `0x${string}`,
        abi: taskRewardContract.abi,
        functionName: "withdrawTaskRemaining",
        args: [BigInt(task.onChainTaskId)],
      });

      // 执行实际交易
      const hash = await walletClient.writeContract(request);
      notification.info("赎回交易已提交");

      // 等待交易确认
      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      if (receipt.status === "success") {
        notification.success("赎回成功");
        // 刷新任务数据
        await fetchTask();
        // 重新获取剩余奖励
        await fetchRemainingReward();
      } else {
        throw new Error("交易失败");
      }
    } catch (error) {
      console.error("赎回失败:", error);
      notification.error("赎回失败: " + (error instanceof Error ? error.message : String(error)));
    } finally {
      setIsWithdrawing(false);
    }
  };

  const canAcceptTask = () => {
    if (!task || !address) return false;

    // 检查是否是自己发布的任务
    if (task.creatorAddress === address) {
      return false;
    }

    // 检查任务是否已达到完成人数上限
    if (completedCount >= taskCount) {
      return false;
    }

    const levelOrder = ["Initiate", "Operative", "Enforcer", "Vanguard", "Prime"];
    const userLevelIndex = levelOrder.indexOf(userLevel);
    const taskLevelIndex = levelOrder.indexOf(task.participationType as LevelType);

    console.log("用户等级:", userLevel);
    console.log("任务等级:", task.participationType);
    console.log("用户等级索引:", userLevelIndex);
    console.log("任务等级索引:", taskLevelIndex);

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
  if (error) return <div className="p-4">错误: {error}</div>;
  if (!task) return <div className="p-4">未找到任务</div>;

  return (
    <div className="bg-black text-white p-4 sm:p-6 mt-4 sm:mt-6">
      <div className="max-w-8xl mx-auto">
        <Link href="/task" className="inline-block mb-4 sm:mb-6">
          <ArrowLeftIcon className="h-6 w-6 text-white hover:text-primary" />
        </Link>
        <div className="flex flex-col lg:flex-row">
          {/* 左侧：任务详情 */}
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
                      由{" "}
                      {task.creatorAddress
                        ? `${task.creatorAddress.slice(0, 6)}...${task.creatorAddress.slice(-4)}`
                        : "未知创建者"}{" "}
                      创建
                    </p>
                    <div className="flex gap-3 ml-4">
                      {task.twitterAccount && (
                        <div
                          className="tooltip tooltip-custom before:!bg-[#424242] before:!text-white before:cursor-pointer before:!whitespace-normal"
                          data-tip={task.twitterAccount}
                          onClick={e => {
                            if ((e.target as HTMLElement).tagName !== "svg") {
                              navigator.clipboard.writeText(task.twitterAccount || "");
                              notification.success("已复制 Twitter 账号");
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
                              notification.success("已复制 Telegram 账号");
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
                  任务进度: {completedCount} / {taskCount}
                </p>
                <progress
                  className="progress progress-primary w-full"
                  value={completedCount}
                  max={taskCount || 1} // 使用 1 作为默认值，避免除以零的错误
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
                  ? "已结束"
                  : isAccepted
                  ? "已接受"
                  : task.creatorAddress === address
                  ? "不能接受自己发布的任务"
                  : completedCount >= taskCount
                  ? "任务已结束"
                  : canAcceptTask()
                  ? "接受任务"
                  : `您的等级（${userLevel}）不足，需要${task.participationType}等级或以上才能接受此任务`}
              </button>
              {canWithdraw && (
                <button
                  className="w-full bg-primary hover:bg-opacity-80 text-white py-3 rounded-lg font-semibold mt-4"
                  onClick={handleWithdraw}
                  disabled={isWithdrawing}
                >
                  {isWithdrawing ? (
                    <div className="flex items-center justify-center">
                      <Loading size="sm" className="mr-2" />
                      赎回中...
                    </div>
                  ) : (
                    `赎回剩余奖励 (${remainingReward} USDT)`
                  )}
                </button>
              )}
            </div>
          </div>

          {/* 右侧：参与者列表 */}
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
