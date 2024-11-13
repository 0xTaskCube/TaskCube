"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import CheckIn from "../../components/ui/CheckIn";
import { ClaimModal } from "../../components/ui/ClaimModal";
import CubeIcon from "../../components/ui/CubeIcon";
import { Loading } from "../../components/ui/Loading";
import "../../styles/cube-icon.scss";
import { FaInfoCircle } from "react-icons/fa";
import { useAccount } from "wagmi";
import { ClipboardDocumentListIcon, Squares2X2Icon } from "@heroicons/react/24/outline";
import { BlockieAvatar } from "~~/components/scaffold-eth";
import { notification } from "~~/utils/scaffold-eth";

type LevelType = "Initiate" | "Operative" | "Enforcer" | "Vanguard" | "Prime";

const DashboardCard = ({
  title,
  value,
  link,
  level,
  action,
  tooltip,
}: {
  title: string;
  value: string;
  link?: string;
  level?: LevelType;
  action?: { text: string; onClick: () => void };
  tooltip?: string;
}) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const handleMouseEnter = useCallback(() => setShowTooltip(true), []);
  const handleMouseLeave = useCallback(() => setShowTooltip(false), []);

  return (
    <div className="bg-base-400 border border-[#424242] p-4 rounded-lg shadow-lg">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-gray-400 text-sm font-medium mb-2 flex items-center">
            {title}
            {tooltip && (
              <div className="relative inline-block ml-2">
                <FaInfoCircle
                  className="text-gray-400 hover:text-gray-300 cursor-help"
                  onMouseEnter={handleMouseEnter}
                  onMouseLeave={handleMouseLeave}
                />
                {showTooltip && (
                  <div className="absolute z-10 w-64 p-2 mt-2 text-sm text-gray-400 bg-base-300 rounded-lg shadow-lg whitespace-pre-line left-0">
                    {tooltip}
                  </div>
                )}
              </div>
            )}
          </h3>
          <div className="flex items-center">
            {level && (
              <div className="mr-4 ml-2 flex mt-2 items-center justify-center">
                <CubeIcon level={level} />
              </div>
            )}
            <p className="text-white text-3xl font-bold mt-6">{value}</p>
          </div>
        </div>
        <div>
          {link && (
            <Link href={link} className="text-primary hover:text-primary-dark transition-colors">
              Deposit
            </Link>
          )}
          {action && (
            <button onClick={action.onClick} className="text-primary hover:text-primary-dark transition-colors">
              {action.text}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

interface CompletedTask {
  id: string;
  title: string;
  completedDate: string;
  creatorAddress: string;
  userReward: string;
  inviterReward?: string;
}

const TaskRecord = ({
  title,
  userReward,
  inviterReward,
  date,
  creatorAddress,
}: {
  title: string;
  userReward: string;
  inviterReward?: string;
  date: string;
  creatorAddress: string;
}) => {
  const formattedDate = new Date(date)
    .toLocaleString("en-US", {
      timeZone: "Asia/Shanghai",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
    .replace(/(\d+)\/(\d+)\/(\d+)/, "$3-$1-$2");

  return (
    <tr className="border-b border-[#424242]">
      <td className="py-4 pl-4 sm:pl-6 pr-2 sm:pr-4 w-1/2 sm:w-[45%]">
        <div className="flex items-center">
          <BlockieAvatar address={creatorAddress} size={24} />
          <span className="text-white text-sm sm:text-base truncate ml-2">{title}</span>
        </div>
      </td>
      <td className="py-4 px-2 sm:px-4 w-1/4 sm:w-[20%]">
        <div className="flex flex-col">
          <span className="text-primary">+ {userReward} USDT</span>
        </div>
      </td>
      <td className="py-4 px-2 sm:px-4 w-1/4 sm:w-[20%] text-primary text-sm sm:text-base">
        {inviterReward ? `+ ${inviterReward} USDT` : "-"}
      </td>
      <td className="hidden sm:table-cell py-4 pl-4 pr-6 sm:w-[15%] text-gray-400 text-sm sm:text-base text-right">
        {formattedDate}
      </td>
    </tr>
  );
};

const Dashboard = () => {
  const [availableBalance, setAvailableBalance] = useState("0");
  const [userLevel, setUserLevel] = useState<{ level: LevelType }>({ level: "Initiate" });
  const [bounty, setBounty] = useState("0");
  const { address } = useAccount();
  const [completedTasks, setCompletedTasks] = useState<CompletedTask[]>([]);
  const [_invites, setInvites] = useState<any[]>([]);
  const [isClaimModalOpen, setIsClaimModalOpen] = useState(false);
  const [inviterRewards, setInviterRewards] = useState("0");
  const [bountyId, setBountyId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (address) {
        setIsLoading(true);
        try {
          const [balanceResponse, invitesResponse] = await Promise.all([
            fetch(`/api/DepositWithdrawal?userAddress=${address}&action=getBalance`),
            fetch(`/api/invites?inviter=${address}`),
          ]);

          const [balanceData, invitesData] = await Promise.all([balanceResponse.json(), invitesResponse.json()]);

          if (balanceData.success) {
            const balance = parseFloat(balanceData.availableBalance);
            setAvailableBalance(balance.toFixed(2));

            const qualifiedInvitesPrime =
              invitesData.invites?.filter((invite: any) => parseFloat(invite.balance) >= 1000).length || 0;

            const qualifiedInvitesVanguard =
              invitesData.invites?.filter((invite: any) => parseFloat(invite.balance) >= 1000).length || 0;

            // Set user level
            if (balance >= 3000 && qualifiedInvitesPrime >= 120) {
              setUserLevel({ level: "Prime" });
            } else if (balance >= 3000 && qualifiedInvitesVanguard >= 11) {
              setUserLevel({ level: "Vanguard" });
            } else if (balance >= 3000) {
              setUserLevel({ level: "Enforcer" });
            } else if (balance >= 1000) {
              setUserLevel({ level: "Operative" });
            } else {
              setUserLevel({ level: "Initiate" });
            }
          }

          if (invitesData.invites) {
            setInvites(invitesData.invites);
          }

          const bountyResponse = await fetch(`/api/task/getBounty?address=${address}`);
          const bountyData = await bountyResponse.json();

          if (bountyData.success) {
            setBounty(bountyData.bounty);

            const totalInviterRewards = (
              parseFloat(bountyData.details.directInviterRewards) +
              parseFloat(bountyData.details.indirectInviterRewards)
            ).toFixed(2);
            setInviterRewards(totalInviterRewards);

            const tasksResponse = await fetch(`/api/task?address=${address}`);
            const tasksData = await tasksResponse.json();

            if (tasksData.acceptedTasks) {
              const completedTasks = tasksData.acceptedTasks
                .filter((task: any) =>
                  task.participants.some((p: any) => p.address === address && p.status === "approved"),
                )
                .map((task: any) => {
                  const distribution = bountyData.details?.distributions?.find(
                    (d: any) => d.taskId.toString() === task._id.toString(),
                  );

                  return {
                    id: task._id,
                    title: task.title,
                    userReward: distribution?.userReward?.toFixed(2) || "0",
                    inviterReward: distribution?.directInviterReward?.toFixed(2) || "0",
                    completedDate:
                      task.participants.find((p: any) => p.address === address)?.approvedDate || task.endDate,
                    creatorAddress: task.creatorAddress,
                  };
                });

              setCompletedTasks(completedTasks);
            }
          }
        } catch (error) {
          console.error("Failed to get data:", error);
          notification.error("Failed to get data");
        } finally {
          setIsLoading(false);
        }
      }
    };

    fetchData();
  }, [address]);

  const handleClaimBounty = useCallback(() => {
    console.log("Current status:", {
      bounty,
      bountyId,
      inviterRewards,
      availableAmount: bountyId ? bounty : inviterRewards,
    });

    if (parseFloat(bounty) > 0) {
      setBountyId("task");
      setIsClaimModalOpen(true);
    }
  }, [bounty, inviterRewards]);

  const levelTooltip = `
Level Description:

🟢 Initiate
   • Newbie Welcome Level

🔵 Operative
   • Margin ≥ 1000 USDT

🔴 Enforcer
   • Margin ≥ 3000 USDT

🟣 Vanguard
   • Margin ≥ 3000 USDT
   • Invite 11 Operative users

🟡 Prime
   • Margin ≥ 3000 USDT
   • Invite 120 Operative users
  `.trim();

  const cardData = [
    { title: "Effective Margin", value: `$${availableBalance}`, link: "/user-dw" },
    { title: "Task Reward", value: `$${bounty}`, action: { text: "Claim", onClick: handleClaimBounty } },
    { title: "Level", value: userLevel.level, level: userLevel.level, tooltip: levelTooltip },
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
            <DashboardCard
              key={index}
              title={card.title}
              value={card.value}
              link={card.link}
              level={card.level}
              action={card.action}
              tooltip={card.tooltip}
            />
          ))}
          <CheckIn userLevel={userLevel} />
        </div>

        <div className="bg-base-400 rounded-lg shadow-lg overflow-hidden">
          <h1 className="text-2xl font-bold mb-4 flex items-center">
            <ClipboardDocumentListIcon className="h-6 w-6 mr-2" />
            Task record
          </h1>

          {isLoading ? (
            <table className="w-full border-collapse table-fixed">
              <thead>
                <tr className="bg-base-400">
                  <th className="text-left border-[#424242] py-3 pl-4 sm:pl-6 pr-2 sm:pr-4 w-1/2 sm:w-[45%] text-gray-400 font-medium text-sm sm:text-base">
                    Name
                  </th>
                  <th className="text-left py-3 px-2 sm:px-4 w-1/4 sm:w-[20%] text-gray-400 font-medium text-sm sm:text-base">
                    Reward
                  </th>
                  <th className="text-left py-3 px-2 sm:px-4 w-1/4 sm:w-[20%] text-gray-400 font-medium text-sm sm:text-base">
                    Inviter
                  </th>
                  <th className="hidden sm:table-cell text-right py-3 pl-4 pr-6 sm:w-[15%] text-gray-400 font-medium text-sm sm:text-base">
                    Date
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan={4}>
                    <div className="flex justify-center items-center py-20">
                      <Loading size="lg" color="primary" />
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          ) : completedTasks.length > 0 ? (
            <table className="w-full border-collapse table-fixed">
              <thead>
                <tr className="bg-base-400">
                  <th className="text-left border-[#424242] py-3 pl-4 sm:pl-6 pr-2 sm:pr-4 w-1/2 sm:w-[45%] text-gray-400 font-medium text-sm sm:text-base">
                    Name
                  </th>
                  <th className="text-left py-3 px-2 sm:px-4 w-1/4 sm:w-[20%] text-gray-400 font-medium text-sm sm:text-base">
                    Reward
                  </th>
                  <th className="text-left py-3 px-2 sm:px-4 w-1/4 sm:w-[20%] text-gray-400 font-medium text-sm sm:text-base">
                    Inviter
                  </th>
                  <th className="hidden sm:table-cell text-right py-3 pl-4 pr-6 sm:w-[15%] text-gray-400 font-medium text-sm sm:text-base">
                    Date
                  </th>
                </tr>
              </thead>

              <tbody>
                {completedTasks.map(task => (
                  <TaskRecord
                    key={task.id}
                    title={task.title}
                    userReward={task.userReward}
                    inviterReward={task.inviterReward}
                    date={task.completedDate}
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
        <ClaimModal
          isOpen={isClaimModalOpen}
          onClose={() => setIsClaimModalOpen(false)}
          availableAmount={bountyId ? bounty : inviterRewards}
          bountyId={bountyId || ""}
          type={bountyId ? "task" : "invite"}
        />
      </div>
    </div>
  );
};

export default Dashboard;
