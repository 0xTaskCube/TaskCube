"use client";

import React, { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";
import { ArrowLeftIcon, ArrowTopRightOnSquareIcon } from "@heroicons/react/24/outline";
import { BlockieAvatar } from "~~/components/scaffold-eth";
import { Loading } from "~~/components/ui/Loading";
import { useScaffoldContract } from "~~/hooks/scaffold-eth";
import { notification } from "~~/utils/scaffold-eth";

interface Participant {
  address?: string;
  status: "accepted" | "submitted" | "approved" | "rejected";
}

interface Task {
  id: string;
  title: string;
  reward: string;
  endDate: string;
  status: "published" | "accepted" | "completed" | "rejected" | "pending_approval";
  creatorAddress: string;
  participants: Participant[];
  onChainTaskId?: string;
  isActive: boolean;
}

const MyTasksPage = () => {
  const { address } = useAccount();
  const [publishedTasks, setPublishedTasks] = useState<Task[]>([]);
  const [acceptedTasks, setAcceptedTasks] = useState<Task[]>([]);
  const [taskType, setTaskType] = useState<"published" | "accepted">("published");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [approvingTask, setApprovingTask] = useState<string>("");
  const fetchTasks = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    console.log("正在获取任务，用户地址:", address);

    try {
      if (!address) {
        throw new Error("用户地址未定义");
      }

      const response = await fetch(`/api/task?address=${address}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log("API 返回的原始数据:", data);

      if (!data.publishedTasks || !data.acceptedTasks) {
        console.warn("API 返回的数据格式不正确:", data);
      }

      const processTask = (task: any) => ({
        ...task,
        id: task._id || task.id,
        participants: Array.isArray(task.participants)
          ? task.participants.map((p: any) =>
              typeof p === "string" ? { address: p, status: "accepted" } : { ...p, status: p.status || "accepted" },
            )
          : [],
      });

      const processedPublishedTasks = (data.publishedTasks || []).map(processTask);
      const processedAcceptedTasks = (data.acceptedTasks || []).map(processTask);

      console.log("处理后的已发布任务:", processedPublishedTasks);
      console.log("处理后的已接受任务:", processedAcceptedTasks);

      setPublishedTasks(processedPublishedTasks);
      setAcceptedTasks(processedAcceptedTasks);

      console.log("状态更新后的已发布任务数量:", processedPublishedTasks.length);
      console.log("状态更新后的已接受任务数量:", processedAcceptedTasks.length);
    } catch (error) {
      console.error("获取任务失败:", error);
      setError(error instanceof Error ? error.message : "获取任务失败");
    } finally {
      setIsLoading(false);
    }
  }, [address]);

  useEffect(() => {
    console.log("当前用户地址:", address);
    if (address) {
      fetchTasks();
    } else {
      console.log("用户未连接钱包");
    }
  }, [address, fetchTasks]);

  // 添加必要的 hooks
  const { data: taskRewardContract } = useScaffoldContract({
    contractName: "TaskReward",
  });
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();

  // 修改 handleApprove 函数
  const handleApprove = async (taskId: string, participantAddress: string | undefined) => {
    const operationId = `${taskId}-${participantAddress}`;
    if (approvingTask === operationId) return;

    if (!participantAddress) {
      notification.error("无效的参与者地址");
      return;
    }

    if (!address) {
      notification.error("请先连接钱包");
      return;
    }
    setApprovingTask(operationId);
    try {
      // 1. 先检查合约调用是否可行
      if (!taskRewardContract || !walletClient || !publicClient) {
        throw new Error("合约或钱包客户端未初始化");
      }

      // 获取任务信息
      const task = publishedTasks.find(t => t.id === taskId);
      if (!task?.onChainTaskId) {
        throw new Error("链上任务ID不存在");
      }

      // 检查当前用户是否是任务创建者
      const onChainTask = (await publicClient.readContract({
        address: taskRewardContract.address as `0x${string}`,
        abi: taskRewardContract.abi,
        functionName: "tasks",
        args: [BigInt(task.onChainTaskId)],
      })) as readonly [string, bigint, bigint, bigint, boolean];

      // 确保当前用户是任务创建者
      const creator = onChainTask[0];
      if (creator.toLowerCase() !== address.toLowerCase()) {
        throw new Error("只有任务创建者可以批准完成");
      }

      // 2. 执行合约调用
      const { request } = await publicClient.simulateContract({
        address: taskRewardContract.address as `0x${string}`,
        abi: taskRewardContract.abi,
        functionName: "markTaskCompleted",
        args: [BigInt(task.onChainTaskId)],
        account: address,
      });

      // 执行合约调用
      const hash = await walletClient.writeContract({
        ...request,
        account: address,
      });

      notification.info("合约调用已提交，等待确认...");

      // 等待交易确认
      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      if (receipt.status === "reverted") {
        throw new Error("合约调用被回滚");
      }

      // 3. 只有在合约调用成功后，才更新后端数据库
      const response = await fetch(`/api/task`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, participantAddress, action: "approve" }),
      });

      if (!response.ok) {
        throw new Error("更新任务状态失败");
      }

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.message || "更新任务状态失败");
      }

      notification.success("任务已批准");
      fetchTasks(); // 刷新任务列表
    } catch (error) {
      console.error("批准任务失败:", error);
      notification.error("批准任务失败: " + (error instanceof Error ? error.message : String(error)));
    }
  };

  const handleReject = async (taskId: string, participantAddress: string | undefined) => {
    if (!participantAddress) {
      notification.error("无效的参与者地址");
      return;
    }
    try {
      const response = await fetch(`/api/task`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, participantAddress, action: "reject" }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          notification.success("任务已拒绝");
          // 重置任务状态
          await fetch(`/api/task/resetTaskStatus`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ taskId, participantAddress }),
          });
          // 重新获取任务列表
          fetchTasks();
        } else {
          throw new Error(data.message || "拒绝任务失败");
        }
      } else {
        throw new Error("拒绝任务失败");
      }
    } catch (error) {
      console.error("拒绝任务失败:", error);
      notification.error("拒绝任务失败");
    }
  };

  const handleSubmit = async (taskId: string) => {
    console.log("提交任务:", { taskId, address });

    if (!taskId || !address) {
      console.error("缺少 taskId 或 address:", { taskId, address });
      notification.error("提交失败：缺少必要信息");
      return;
    }

    try {
      const response = await fetch(`/api/task`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, address }),
      });

      const data = await response.json();
      console.log("服务器响应:", data);

      if (!response.ok) {
        throw new Error(data.message || `HTTP 错误! 状态: ${response.status}`);
      }

      notification.success(data.message || "任务已提交审核");
      fetchTasks(); // 刷新任务列表
    } catch (error) {
      console.error("提交任务失败:", error);
      notification.error(error instanceof Error ? error.message : "提交任务失败");
    }
  };

  const TaskItem = ({ task }: { task: Task }) => {
    const { address } = useAccount();
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [participantStatus, setParticipantStatus] = useState<string>("");

    useEffect(() => {
      // 检查当前用户是否已经提交了这个任务，并获取参与者状态
      const currentParticipant = task.participants.find(p => p.address === address);
      setIsSubmitted(currentParticipant?.status === "submitted" || currentParticipant?.status === "approved");
      setParticipantStatus(currentParticipant?.status || "");
    }, [task, address]);

    const isPublishedTask = task.creatorAddress === address;
    // const renderStatus = () => {
    //   if (task.status === "completed") {
    //     return "已完成";
    //   } else if (task.status === "pending_approval") {
    //     return "等待审核";
    //   } else {
    //     const participant = task.participants.find(p => p.address === address);
    //     return participant ? participant.status : task.status;
    //   }
    // };
    return (
      <div className="border border-[#424242] bg-base-400 p-4 rounded-lg mb-6">
        <div className="flex justify-between items-center mb-4">
          <div>
            <div className="flex items-center">
              <span className="text-white text-lg font-semibold mr-4">{task.title}</span>
              <div className="flex items-center">
                <span className="text-gray-400 text-sm">截止日期: {new Date(task.endDate).toLocaleDateString()}</span>
                <Link href={`/task/${task.id}`} className="ml-2">
                  <ArrowTopRightOnSquareIcon className="h-4 w-4 text-gray-400 hover:text-primary cursor-pointer" />
                </Link>
              </div>
            </div>
          </div>
          <div className="flex items-center">
            <Image
              src="https://cryptologos.cc/logos/tether-usdt-logo.png"
              alt="USDT"
              width={20}
              height={20}
              className="mr-2"
            />
            <span className="text-white">{task.reward} USDT</span>
          </div>
        </div>
        {isPublishedTask ? (
          <div>
            <div className="mb-2 text-sm">接受此任务的用户：</div>
            <div className="flex flex-wrap gap-2">
              {task.participants && task.participants.length > 0 ? (
                task.participants.map((participant, index) => (
                  <div key={`${task.id}-${index}`} className="flex items-center bg-gray-800 rounded-full p-2">
                    {participant.address ? (
                      <>
                        <BlockieAvatar address={participant.address} size={24} />
                        <span className="ml-2 text-sm">
                          {participant.address.slice(0, 6)}...{participant.address.slice(-4)}
                        </span>
                        {/* <span className="ml-2 text-xs text-gray-400">state: {participant.status}</span> */}
                        {participant.status === "submitted" ? (
                          <div className="ml-2">
                            <button
                              onClick={() => handleApprove(task.id, participant.address)}
                              disabled={approvingTask === `${task.id}-${participant.address}`}
                              className="bg-primary hover:bg-opacity-80 text-white px-2 py-1 rounded-lg text-xs mr-1"
                            >
                              {approvingTask === `${task.id}-${participant.address}` ? (
                                <span className="flex items-center">批准中...</span>
                              ) : (
                                "批准"
                              )}
                            </button>
                            <button
                              onClick={() => handleReject(task.id, participant.address)}
                              disabled={approvingTask === `${task.id}-${participant.address}`}
                              className="bg-red-500 hover:bg-opacity-80 text-white px-2 py-1 rounded-lg text-xs"
                            >
                              拒绝
                            </button>
                          </div>
                        ) : participant.status === "approved" ? (
                          <span className="ml-2 text-xs text-green-500">已批准</span>
                        ) : participant.status === "rejected" ? (
                          <span className="ml-2 text-xs text-yellow-500">待审核</span>
                        ) : (
                          <span className="ml-2 text-xs text-yellow-500">等待提交</span>
                        )}
                      </>
                    ) : (
                      <span className="text-gray-400">无效地址</span>
                    )}
                  </div>
                ))
              ) : (
                <p className="text-gray-400">暂无用户接受此任务</p>
              )}
            </div>
          </div>
        ) : (
          <div>
            <div className="flex items-center mb-2">
              <span className="mr-2">发布者：</span>
              <BlockieAvatar address={task.creatorAddress} size={24} />
              <span className="ml-2 text-sm">
                {task.creatorAddress.slice(0, 6)}...{task.creatorAddress.slice(-4)}
              </span>
            </div>
            <button
              onClick={() => handleSubmit(task.id)}
              className={`text-white px-4 py-2 rounded-lg text-sm ${
                participantStatus === "approved" || isSubmitted ? "bg-custom-hover" : "bg-primary hover:bg-opacity-80"
              }`}
              disabled={participantStatus === "approved"}
            >
              {participantStatus === "approved"
                ? "已完成"
                : participantStatus === "rejected"
                ? "提交审核"
                : isSubmitted
                ? "已提交"
                : "提交审核"}
            </button>
          </div>
        )}
      </div>
    );
  };

  const currentTasks = taskType === "published" ? publishedTasks : acceptedTasks;
  console.log("当前显示的任务:", currentTasks);

  return (
    <div className="bg-black text-white p-4 sm:p-6 mt-4 sm:mt-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <Link href="/task" className="inline-block">
            <ArrowLeftIcon className="h-6 w-6 text-white hover:text-primary" />
          </Link>
        </div>

        <div className="mb-6 flex justify-between items-center">
          <h1 className="text-2xl font-bold">我的任务</h1>
          <div className="flex space-x-2">
            <button
              onClick={() => setTaskType("published")}
              className={`px-4 py-2 rounded-lg text-sm ${
                taskType === "published" ? "bg-primary text-white" : "bg-custom-hover text-gray-300"
              }`}
            >
              已发布的任务
            </button>
            <button
              onClick={() => setTaskType("accepted")}
              className={`px-4 py-2 rounded-lg text-sm ${
                taskType === "accepted" ? "bg-primary text-white" : "bg-custom-hover text-gray-300"
              }`}
            >
              已接受的任务
            </button>
          </div>
        </div>

        {/* <div className="mb-4 text-sm text-gray-400">{taskType === "published" ? "已发布的任务" : "已接受的任务"}</div> */}

        {isLoading ? (
          <div className="flex justify-center items-center min-h-[200px]">
            <Loading size="lg" color="primary" />
          </div>
        ) : error ? (
          <p className="text-red-500">{error}</p>
        ) : currentTasks.length > 0 ? (
          currentTasks.map(task => <TaskItem key={task.id} task={task} />)
        ) : (
          <div className="flex justify-center items-center min-h-[200px]">暂无任务</div>
        )}
      </div>
    </div>
  );
};
export default MyTasksPage;
