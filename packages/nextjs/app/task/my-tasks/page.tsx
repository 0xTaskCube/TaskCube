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

    try {
      if (!address) {
        throw new Error("User address is undefined");
      }

      const response = await fetch(`/api/task?address=${address}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (!data.publishedTasks || !data.acceptedTasks) {
        console.warn("API The returned data format is incorrect:", data);
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

      setPublishedTasks(processedPublishedTasks);
      setAcceptedTasks(processedAcceptedTasks);
    } catch (error) {
      console.error("Failed to get task:", error);
      setError(error instanceof Error ? error.message : "Failed to get task");
    } finally {
      setIsLoading(false);
    }
  }, [address]);

  useEffect(() => {
    console.log("User address:", address);
    if (address) {
      fetchTasks();
    } else {
      console.log("User is not connected to wallet");
    }
  }, [address, fetchTasks]);

  const { data: taskRewardContract } = useScaffoldContract({
    contractName: "TaskReward",
  });
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();

  const handleApprove = async (taskId: string, participantAddress: string | undefined) => {
    const operationId = `${taskId}-${participantAddress}`;
    if (approvingTask === operationId) return;

    if (!participantAddress) {
      notification.error("Invalid participant address");
      return;
    }

    if (!address) {
      notification.error("Please connect the wallet");
      return;
    }
    setApprovingTask(operationId);
    try {
      if (!taskRewardContract || !walletClient || !publicClient) {
        throw new Error("The contract or wallet client is not initialized");
      }

      const task = publishedTasks.find(t => t.id === taskId);
      if (!task?.onChainTaskId) {
        throw new Error("The task ID on the chain does not exist");
      }

      const onChainTask = (await publicClient.readContract({
        address: taskRewardContract.address as `0x${string}`,
        abi: taskRewardContract.abi,
        functionName: "tasks",
        args: [BigInt(task.onChainTaskId)],
      })) as readonly [string, bigint, bigint, bigint, boolean];

      const creator = onChainTask[0];
      if (creator.toLowerCase() !== address.toLowerCase()) {
        throw new Error("Only the task creator can approve completion");
      }

      const { request } = await publicClient.simulateContract({
        address: taskRewardContract.address as `0x${string}`,
        abi: taskRewardContract.abi,
        functionName: "markTaskCompleted",
        args: [BigInt(task.onChainTaskId)],
        account: address,
      });

      const hash = await walletClient.writeContract({
        ...request,
        account: address,
      });

      notification.info("Confirming...");

      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      if (receipt.status === "reverted") {
        throw new Error("Contract call is rolled back");
      }

      const response = await fetch(`/api/task`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, participantAddress, action: "approve" }),
      });

      if (!response.ok) {
        throw new Error("Failed to update task status");
      }

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.message || "Failed to update task status");
      }

      notification.success("Task approved");
      fetchTasks();
    } catch (error) {
      console.error("Approval task failed:", error);
      notification.error("Approval task failed: " + (error instanceof Error ? error.message : String(error)));
    }
  };

  const handleReject = async (taskId: string, participantAddress: string | undefined) => {
    if (!participantAddress) {
      notification.error("Invalid participant address");
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
          notification.success("Task rejected");

          await fetch(`/api/task/resetTaskStatus`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ taskId, participantAddress }),
          });

          fetchTasks();
        } else {
          throw new Error(data.message || "Reject task failed");
        }
      } else {
        throw new Error("Reject task failed");
      }
    } catch (error) {
      console.error("Reject task failed:", error);
      notification.error("Reject task failed");
    }
  };

  const handleSubmit = async (taskId: string) => {
    console.log("Submit task:", { taskId, address });

    if (!taskId || !address) {
      notification.error("Submission failed: required information missing");
      return;
    }

    try {
      const response = await fetch(`/api/task`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, address }),
      });

      const data = await response.json();
      console.log("Server response:", data);

      if (!response.ok) {
        throw new Error(data.message || `HTTP Error! Status: ${response.status}`);
      }

      notification.success(data.message || "Submitted for review");
      fetchTasks();
    } catch (error) {
      console.error("Failed to submit task:", error);
      notification.error(error instanceof Error ? error.message : "Failed to submit task");
    }
  };

  const TaskItem = ({ task }: { task: Task }) => {
    const { address } = useAccount();
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [participantStatus, setParticipantStatus] = useState<string>("");

    useEffect(() => {
      const currentParticipant = task.participants.find(p => p.address === address);
      setIsSubmitted(currentParticipant?.status === "submitted" || currentParticipant?.status === "approved");
      setParticipantStatus(currentParticipant?.status || "");
    }, [task, address]);

    const isPublishedTask = task.creatorAddress === address;
    // const renderStatus = () => {
    //   if (task.status === "completed") {
    //     return "Completed";
    //   } else if (task.status === "pending_approval") {
    //     return "Waiting for review";
    //   } else {
    //     const participant = task.participants.find(p => p.address === address);
    //     return participant ? participant.status : task.status;
    //   }
    // };
    return (
      <div className="border border-[#424242] bg-base-400 p-4 rounded-lg mb-6">
        <div className="flex justify-between items-center mb-8">
          <div>
            <div className="flex items-center">
              <span className="text-white text-lg font-semibold mr-4">{task.title}</span>
              <div className="flex items-center">
                <span className="text-gray-400 text-sm">
                  Expiration date: {new Date(task.endDate).toLocaleDateString()}
                </span>
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
            <div className="mb-2 text-sm">User：</div>
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
                                <span className="flex items-center">Approving...</span>
                              ) : (
                                "Approve"
                              )}
                            </button>
                            <button
                              onClick={() => handleReject(task.id, participant.address)}
                              disabled={approvingTask === `${task.id}-${participant.address}`}
                              className="bg-red-500 hover:bg-opacity-80 text-white px-2 py-1 rounded-lg text-xs"
                            >
                              Reject
                            </button>
                          </div>
                        ) : participant.status === "approved" ? (
                          <span className="ml-2 text-xs text-green-500">Approved</span>
                        ) : participant.status === "rejected" ? (
                          <span className="ml-2 text-xs text-yellow-500">Pending</span>
                        ) : (
                          <span className="ml-2 text-xs text-yellow-500">submissioning</span>
                        )}
                      </>
                    ) : (
                      <span className="text-gray-400">Invalid address</span>
                    )}
                  </div>
                ))
              ) : (
                <p className="text-gray-400">No user has accepted this task yet</p>
              )}
            </div>
          </div>
        ) : (
          <div>
            <div className="flex items-center mb-2">
              <span className="mr-2">Creator:</span>
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
                ? "Approved"
                : participantStatus === "rejected"
                ? "Submit Task"
                : isSubmitted
                ? "Submited"
                : "Submit Task"}
            </button>
          </div>
        )}
      </div>
    );
  };

  const currentTasks = taskType === "published" ? publishedTasks : acceptedTasks;

  return (
    <div className="bg-black text-white p-4 sm:p-6 mt-4 sm:mt-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <Link href="/task" className="inline-block">
            <ArrowLeftIcon className="h-6 w-6 text-white hover:text-primary" />
          </Link>
        </div>

        <div className="mb-6 flex justify-between items-center">
          <h1 className="text-2xl font-bold">My task</h1>
          <div className="flex space-x-2">
            <button
              onClick={() => setTaskType("published")}
              className={`px-4 py-2 rounded-lg text-sm ${
                taskType === "published" ? "bg-primary text-white" : "bg-custom-hover text-gray-300"
              }`}
            >
              Created tasks
            </button>
            <button
              onClick={() => setTaskType("accepted")}
              className={`px-4 py-2 rounded-lg text-sm ${
                taskType === "accepted" ? "bg-primary text-white" : "bg-custom-hover text-gray-300"
              }`}
            >
              Accepted tasks
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center items-center min-h-[200px]">
            <Loading size="lg" color="primary" />
          </div>
        ) : error ? (
          <p className="text-red-500">{error}</p>
        ) : currentTasks.length > 0 ? (
          currentTasks.map(task => <TaskItem key={task.id} task={task} />)
        ) : (
          <div className="flex justify-center items-center min-h-[200px]">No tasks yet</div>
        )}
      </div>
    </div>
  );
};
export default MyTasksPage;
