"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import CubeIcon from "../../components/ui/CubeIcon";
import "../../styles/cube-icon.scss";
import { useAccount } from "wagmi";
import { ClipboardDocumentListIcon, Squares2X2Icon } from "@heroicons/react/24/outline";
import { BlockieAvatar } from "~~/components/scaffold-eth";

type LevelType = "Initiate" | "Operative" | "Enforcer" | "Vanguard" | "Prime";

const DashboardCard = ({
  title,
  value,
  link,
  level,
}: {
  title: string;
  value: string;
  link?: string;
  level?: LevelType;
}) => (
  <div className="bg-base-400 border border-[#424242] p-4 rounded-lg shadow-lg relative">
    <h3 className="text-gray-400 text-sm font-medium mb-2">{title}</h3>
    <div className="flex items-center">
      {level && (
        <div className="mr-6 ml-2  flex items-center justify-center">
          <CubeIcon level={level} />
        </div>
      )}
      <p className="text-white text-3xl font-bold">{value}</p>
    </div>
    {link && (
      <Link
        href={link}
        className="absolute top-2 right-2 text-primary p-2 rounded-full hover:bg-primary-dark transition-colors"
      >
        Deposit
      </Link>
    )}
  </div>
);

interface CompletedTask {
  id: string;
  title: string;
  reward: string;
  completedDate: string;
  creatorAddress: string;
}

const TaskRecord = ({
  title,
  reward,
  Inviter,
  date,
  creatorAddress,
}: {
  title: string;
  reward: string;
  Inviter: string;
  date: string;
  creatorAddress: string;
}) => (
  <tr className="border-b border-[#424242]">
    <td className="py-4 pl-4 sm:pl-6 pr-2 sm:pr-4 w-1/2 sm:w-2/5">
      <div className="flex items-center">
        <BlockieAvatar address={creatorAddress} size={24} />
        <span className="text-white text-sm sm:text-base truncate ml-2">{title}</span>
      </div>
    </td>
    <td className="py-4 px-2 sm:px-4 w-1/4 sm:w-1/5">
      <span className="bg-primary text-white text-xs px-2 py-1 rounded-full">{reward} USDT</span>
    </td>
    <td className="py-4 px-2 sm:px-4 w-1/4 sm:w-1/5 text-primary text-sm sm:text-base">{Inviter}</td>
    <td className="hidden sm:table-cell py-4 pl-4 pr-6 w-1/5 text-gray-400 text-sm sm:text-base">{date}</td>
  </tr>
);

const Dashboard = () => {
  const [availableBalance, setAvailableBalance] = useState("0");
  const [userLevel, setUserLevel] = useState<{ level: LevelType }>({ level: "Initiate" });
  const [bounty, setBounty] = useState("0");
  const { address } = useAccount();
  const [completedTasks, setCompletedTasks] = useState<CompletedTask[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      if (address) {
        try {
          // 获取余额
          const balanceResponse = await fetch(`/api/DepositWithdrawal?userAddress=${address}&action=getBalance`);
          const balanceData = await balanceResponse.json();
          if (balanceData.success) {
            const balance = parseFloat(balanceData.availableBalance);
            setAvailableBalance(balance.toFixed(2));

            // 根据余额设置用户等级
            if (balance >= 3000) {
              setUserLevel({ level: "Prime" });
            } else if (balance >= 2000) {
              setUserLevel({ level: "Vanguard" });
            } else if (balance >= 1000) {
              setUserLevel({ level: "Enforcer" });
            } else if (balance >= 500) {
              setUserLevel({ level: "Operative" });
            } else {
              setUserLevel({ level: "Initiate" });
            }
          }
          const bountyResponse = await fetch(`/api/task/getBounty?address=${address}`);
          const bountyData = await bountyResponse.json();
          console.log("获取到的 Bounty 数据:", bountyData);
          if (bountyData.success) {
            setBounty(bountyData.bounty.toFixed(2));
          } else {
            console.error("获取 Bounty 失败:", bountyData.message);
          }

          // 获取已完成的任务
          const tasksResponse = await fetch(`/api/task?address=${address}`);
          const tasksData = await tasksResponse.json();
          console.log("获取到的任务数据:", tasksData);

          if (tasksData.acceptedTasks) {
            const completedTasks = tasksData.acceptedTasks
              .filter((task: any) =>
                task.participants.some((p: any) => p.address === address && p.status === "approved"),
              )
              .map((task: any) => ({
                id: task._id || task.id,
                title: task.title,
                reward: task.reward,
                completedDate: task.endDate, // 使用 endDate 作为完成日期
                creatorAddress: task.creatorAddress,
              }));
            setCompletedTasks(completedTasks);
          } else {
            console.error("获取已完成任务失败:", tasksData.message);
          }
        } catch (error) {
          console.error("获取数据失败:", error);
        }
      }
    };

    fetchData();
  }, [address]);

  const cardData = [
    { title: "Effective Margin", value: `$${availableBalance}`, link: "/user-dw" },
    { title: "Effective Bounty", value: `$${bounty}` },
    { title: "Level", value: userLevel.level, level: userLevel.level },
    { title: "Daily Check-in", value: "42" },
  ];

  return (
    <div className="bg-black text-white p-6 mt-6 relative">
      <div className="relative z-10">
        <h1 className="text-2xl font-bold mb-4 flex items-center">
          <Squares2X2Icon className="h-6 w-6 mr-2" />
          Dashboard
        </h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {cardData.map((card, index) => (
            <DashboardCard key={index} title={card.title} value={card.value} link={card.link} level={card.level} />
          ))}
        </div>

        <div className="base-400 rounded-lg shadow-lg overflow-hidden">
          <h1 className="text-2xl font-bold mb-4 flex items-center">
            <ClipboardDocumentListIcon className="h-6 w-6 mr-2" />
            Task record
          </h1>
          {completedTasks.length > 0 ? (
            <table className="w-full border-collapse table-fixed">
              <thead>
                <tr className="bg-base-400">
                  <th className="text-left border-[#424242] py-3 pl-4 sm:pl-6 pr-2 sm:pr-4 w-1/2 sm:w-2/5 text-gray-400 font-medium text-sm sm:text-base">
                    Name
                  </th>
                  <th className="text-left py-3 px-2 sm:px-4 w-1/4 sm:w-1/5 text-gray-400 font-medium text-sm sm:text-base">
                    Reward
                  </th>
                  <th className="text-left py-3 px-2 sm:px-4 w-1/4 sm:w-1/5 text-gray-400 font-medium text-sm sm:text-base">
                    Inviter
                  </th>
                  <th className="hidden sm:table-cell text-left py-3 pl-4 pr-6 w-1/5 text-gray-400 font-medium text-sm sm:text-base">
                    Date
                  </th>
                </tr>
              </thead>
              <tbody>
                {completedTasks.map(task => (
                  <TaskRecord
                    key={task.id}
                    title={task.title}
                    reward={task.reward}
                    Inviter="+46.18" // 暂时使用固定值
                    date={new Date(task.completedDate).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    creatorAddress={task.creatorAddress}
                  />
                ))}
              </tbody>
            </table>
          ) : (
            <div className="flex flex-col items-center justify-center py-12">
              <p className="text-gray-400 mb-4">You haven't received the reward yet, hurry up and complete the task</p>
              <Link
                href="/task"
                className="bg-primary hover:bg-primary-dark text-white font-bold py-2 px-4 rounded transition duration-150 ease-in-out"
              >
                Complete Task
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
