"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useAccount } from "wagmi";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import { BlockieAvatar } from "~~/components/scaffold-eth";
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
}

interface Participant {
  address: string;
  status: string;
}

const TaskDetailPage = ({ params }: { params: { taskId: string } }) => {
  const { address } = useAccount();
  const [isTaskExpired, setIsTaskExpired] = useState(false);
  const [task, setTask] = useState<TaskDetail | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<string>("");
  const [isAccepted, setIsAccepted] = useState(false);
  const [userLevel, setUserLevel] = useState<LevelType>("Initiate");

  const fetchTask = async () => {
    try {
      const response = await fetch(`/api/task?taskId=${params.taskId}`);
      if (response.ok) {
        const data = await response.json();
        setTask(data);
        setParticipants(data.participants || []);
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
    const fetchTask = async () => {
      try {
        const response = await fetch(`/api/task?taskId=${params.taskId}`);
        if (response.ok) {
          const data = await response.json();
          setTask(data);
          // 使用从API返回的参与者数据，而不是模拟数据
          setParticipants(data.participants || []);
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
    fetchTask();
  }, [params.taskId]);

  useEffect(() => {
    const fetchUserLevel = async () => {
      if (address) {
        try {
          const response = await fetch(`/api/task/getUserLevel?address=${address}`);
          const data = await response.json();
          if (data.success) {
            setUserLevel(data.level as LevelType);
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
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || "接受任务失败");
      }
    } catch (error) {
      console.error("接受任务失败:", error);
      notification.error("接受任务失败");
    }
  };
  const canAcceptTask = () => {
    if (!task) return false;
    const levelOrder = ["Initiate", "Operative", "Enforcer", "Vanguard", "Prime"];
    const userLevelIndex = levelOrder.indexOf(userLevel);
    const taskLevelIndex = levelOrder.indexOf(task.level);
    return userLevelIndex >= taskLevelIndex;
  };
  if (loading) return <div className="p-4">加载中...</div>;
  if (error) return <div className="p-4">错误: {error}</div>;
  if (!task) return <div className="p-4">未找到任务</div>;

  return (
    <div className="bg-black text-white p-4 sm:p-6 mt-4 sm:mt-6">
      <div className="max-w-6xl mx-auto">
        <Link href="/task" className="inline-block mb-4 sm:mb-6">
          <ArrowLeftIcon className="h-6 w-6 text-white hover:text-primary" />
        </Link>
        <div className="flex flex-col lg:flex-row">
          {/* 左侧：任务详情 */}
          <div className="w-full lg:w-2/3 lg:pr-6 mb-6 lg:mb-0">
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
                  <h1 className="text-xl sm:text-2xl font-bold">{task.title}</h1>
                  <p className="text-sm sm:text-base text-gray-400 mt-1">
                    {" "}
                    {/* 这里添加了 mt-1 来减小间距 */}由{" "}
                    {task.creatorAddress
                      ? `${task.creatorAddress.slice(0, 6)}...${task.creatorAddress.slice(-4)}`
                      : "未知创建者"}{" "}
                    创建
                  </p>
                </div>
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
                  { title: "Rewards Remaining", content: `${participants.length} / 10` },
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
                  : canAcceptTask()
                  ? "接受任务"
                  : `你只能接受${userLevel}等级及以下的任务`}
              </button>
            </div>
          </div>

          {/* 右侧：参与者列表 */}
          <div className="w-full lg:w-1/3">
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
