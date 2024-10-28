"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { BlockieAvatar } from "~~/components/scaffold-eth";

interface Quest {
  id: string;
  name: string;
  creator: string;
  reward: string;
  timeRemaining: string;
  creatorAddress: string;
  taskType: string;
  participationType: string;
  completedCount: number;
  taskCount: number;
}
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

const getTaskTypeColor = (type: string): string => {
  return type === "individual" ? "bg-green-600" : "bg-blue-400";
};

const QuestItem = ({
  id,
  name,
  creatorAddress,
  reward,
  timeRemaining,
  taskType,
  participationType,
  completedCount,
  taskCount,
}: Quest) => {
  const [isTaskExpired, setIsTaskExpired] = useState(false);
  const [formattedTimeRemaining, setFormattedTimeRemaining] = useState("");
  const isTaskCompleted = completedCount >= taskCount;

  useEffect(() => {
    const calculateTimeRemaining = () => {
      const now = new Date();
      const endDate = new Date(timeRemaining);
      const timeDiff = endDate.getTime() - now.getTime();

      if (timeDiff <= 0 || isTaskCompleted) {
        setFormattedTimeRemaining("Task ended");
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

        setFormattedTimeRemaining(remainingText.trim());
        setIsTaskExpired(false);
      }
    };

    calculateTimeRemaining();
    const timer = setInterval(calculateTimeRemaining, 60000);

    return () => clearInterval(timer);
  }, [timeRemaining, isTaskCompleted]);

  return (
    <Link href={`/task/${id}`} className="block">
      <div className="hover:bg-custom-hover cursor-pointer border border-[#424242] bg-base-400 p-4 rounded-lg mb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="relative flex items-center">
              <div
                className={`w-2 h-2 rounded-full mr-3 ${
                  isTaskExpired || isTaskCompleted ? "bg-red-500" : "bg-green-500 animate-pulse"
                }`}
              ></div>
              {creatorAddress ? (
                <BlockieAvatar address={creatorAddress} size={48} />
              ) : (
                <div className="w-12 h-12 bg-gray-600 rounded-full flex items-center justify-center">
                  <span className="text-2xl">{name && name.length > 0 ? name.charAt(0).toUpperCase() : "?"}</span>
                </div>
              )}
            </div>
            <div>
              <h3 className="text-white text-base mb-2 font-semibold truncate">{name || "未命名任务"}</h3>
              <p className="text-gray-400 text-xs -mt-0.5 truncate mb-2">
                {creatorAddress ? `${creatorAddress.slice(0, 6)}...${creatorAddress.slice(-4)}` : "未知创建者"}
              </p>
              <div className="flex items-center space-x-2 text-xs">
                <span className={`${getTaskTypeColor(taskType)} text-white px-2 py-1 rounded`}>
                  {taskType === "individual" ? "个人任务" : "团队任务"}
                </span>
                <span className={`${getParticipationTypeColor(participationType)} text-white px-2 py-1 rounded`}>
                  {participationType}
                </span>
                <span className={`${isTaskCompleted ? "bg-red-500" : "bg-gray-500"} text-white px-2 py-1 rounded`}>
                  {completedCount} / {taskCount}
                </span>
              </div>
            </div>
          </div>
          <div className="text-right">
            <p className="text-white text-lg font-semibold flex items-center justify-end">
              <Image
                src="https://cryptologos.cc/logos/tether-usdt-logo.png"
                alt="USDT"
                width={20}
                height={20}
                className="mr-2"
              />
              {reward} USDT
            </p>
            <p className="text-gray-400 text-sm mt-1">{isTaskCompleted ? "已结束" : formattedTimeRemaining}</p>
          </div>
        </div>
      </div>
    </Link>
  );
};

const AllQuestsPage = () => {
  const [quests, setQuests] = useState<Quest[]>([]);
  const [visibleQuests, setVisibleQuests] = useState(10);

  useEffect(() => {
    const fetchTasks = async () => {
      try {
        const response = await fetch("/api/task");
        const data = await response.json();
        const formattedQuests = data.map((task: any) => ({
          id: task._id,
          name: task.title,
          creator: task.creator || "未知创建者",
          creatorAddress: task.creatorAddress,
          reward: task.reward,
          timeRemaining: getTimeRemaining(task.endDate),
          taskType: task.taskType,
          participationType: task.participationType,
          completedCount: (task.participants || []).filter((p: any) => p.status === "approved").length,
          taskCount: parseInt(task.taskCount) || 0,
        }));
        setQuests(formattedQuests);
      } catch (error) {
        console.error("获取任务失败:", error);
      }
    };
    fetchTasks();
  }, []);

  const getTimeRemaining = (endDate: string) => {
    return endDate;
  };

  const handleLoadMore = () => {
    setVisibleQuests(quests.length);
  };

  return (
    <div className="bg-black text-white p-6 mt-6">
      <div className="mx-auto">
        <h1 className="text-2xl font-bold mb-2 flex items-center">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6 mr-2"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
            />
          </svg>
          All Tasks
        </h1>
        <p className="text-gray-400 mb-4">All other High-Value quests that are available to you.</p>
        <div className="flex flex-row justify-between items-center mb-4 space-x-2">
          {/* <div className="relative flex-grow">
            <input
              type="text"
              placeholder="Search"
              className="md:w-1/4 w-1/2 border border-[#424242] bg-black text-white rounded-lg pl-10 pr-4 py-2
                 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent
                 transition duration-150 ease-in-out"
            />
            <Search
              className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none"
              size={20}
            />
          </div> */}
          <Link
            href="/task/my-tasks"
            className="btn btn-primary btn-sm py-2 px-4 rounded transition-colors text-center whitespace-nowrap"
          >
            我的任务
          </Link>
          <Link
            href="/task/create"
            className="btn btn-primary btn-sm py-2 px-4 rounded  transition-colors text-center whitespace-nowrap"
          >
            发布任务
          </Link>
        </div>

        <div className="space-y-2">
          {quests.slice(0, visibleQuests).map((quest, index) => (
            <QuestItem key={index} {...quest} />
          ))}
        </div>

        {visibleQuests < quests.length && (
          <button
            onClick={handleLoadMore}
            className="w-full border border-[#424242] bg-base-400 text-white py-3 rounded-lg mt-4 hover:bg-primary transition-colors"
          >
            Load More
          </button>
        )}
      </div>
    </div>
  );
};

export default AllQuestsPage;
