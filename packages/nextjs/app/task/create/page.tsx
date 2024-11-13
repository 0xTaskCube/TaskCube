"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import dayjs from "dayjs";
import { FaPaperPlane, FaXTwitter } from "react-icons/fa6";
import { decodeEventLog, parseUnits } from "viem";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";
import { ArrowLeftIcon, ChevronDownIcon } from "@heroicons/react/24/outline";
import { RainbowKitCustomConnectButton } from "~~/components/scaffold-eth";
import { Loading } from "~~/components/ui/Loading";
import { useScaffoldContract } from "~~/hooks/scaffold-eth";
import { notification } from "~~/utils/scaffold-eth";

const darkTheme = createTheme({
  palette: {
    mode: "dark",
  },
});
const USDT_ADDRESS = "0xaA8E23Fb1079EA71e0a56F48a2aA51851D8433D0";
const usdtAbi = [
  {
    constant: false,
    inputs: [
      { name: "_spender", type: "address" },
      { name: "_value", type: "uint256" },
    ],
    name: "approve",
    outputs: [{ name: "", type: "bool" }],
    type: "function",
  },
] as const;

const CreateTaskPage = () => {
  const { isConnected } = useAccount();
  const { address } = useAccount();
  const router = useRouter();
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [taskData, setTaskData] = useState({
    title: "",
    description: "",
    startDate: "",
    endDate: "",
    reward: "",
    taskCount: "",
    taskType: "individual",
    participationType: "Initiate",
    specificAddresses: "",
    twitterAccount: "",
    telegramAccount: "",
  });
  const [totalReward, setTotalReward] = useState("0");
  const [duration, setDuration] = useState({ days: 0, hours: 0, minutes: 0 });
  const [isLoading, setIsLoading] = useState(false);

  const participationOptions = [
    { value: "Initiate", label: "Initiate", minReward: 0 },
    { value: "Operative", label: "Operative", minReward: 100 },
    { value: "Enforcer", label: "Enforcer", minReward: 300 },
    { value: "Vanguard", label: "Vanguard", minReward: 500 },
    { value: "Prime", label: "Prime", minReward: 1000 },
  ];

  useEffect(() => {
    if (taskData.startDate && taskData.endDate) {
      const start = new Date(taskData.startDate);
      const end = new Date(taskData.endDate);
      const diff = end.getTime() - start.getTime();
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      setDuration({ days, hours, minutes });
    }
  }, [taskData.startDate, taskData.endDate]);

  const validateForm = () => {
    const newErrors: { [key: string]: string } = {};
    if (!taskData.title.trim()) newErrors.title = "Please enter a title";
    if (!taskData.description.trim()) newErrors.description = "Please enter a task description";
    if (!taskData.startDate) newErrors.startDate = "Please select a start date";
    if (!taskData.endDate) newErrors.endDate = "Please select a end date";
    if (!taskData.reward.trim()) newErrors.reward = "Please enter bonus amount";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();
  const { data: taskRewardContract } = useScaffoldContract({
    contractName: "TaskReward",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConnected) {
      notification.error("Please connect the wallet first");
      return;
    }

    if (!validateForm()) {
      return;
    }

    if (!taskRewardContract || !walletClient || !publicClient || !address) {
      notification.error("Contract is not ready");
      return;
    }

    setIsLoading(true);
    try {
      const totalRewardAmount = parseUnits((Number(taskData.reward) * Number(taskData.taskCount)).toString(), 6);
      const totalParticipants = BigInt(taskData.taskCount);

      const { request: approveRequest } = await publicClient.simulateContract({
        account: address,
        address: USDT_ADDRESS as `0x${string}`,
        abi: usdtAbi,
        functionName: "approve",
        args: [taskRewardContract.address, totalRewardAmount],
      });

      notification.info("Please authorize USDT");
      const approveTx = await walletClient.writeContract(approveRequest);
      await publicClient.waitForTransactionReceipt({ hash: approveTx });

      notification.info("Confirm task creation");
      const { request: createTaskRequest } = await publicClient.simulateContract({
        account: address,
        address: taskRewardContract.address,
        abi: taskRewardContract.abi,
        functionName: "createTask",
        args: [totalRewardAmount, totalParticipants],
      });

      const createTaskTx = await walletClient.writeContract(createTaskRequest);
      const receipt = await publicClient.waitForTransactionReceipt({ hash: createTaskTx });

      // taskId
      const taskCreatedEvent = receipt.logs
        .map(log => {
          try {
            return decodeEventLog({
              abi: taskRewardContract.abi,
              data: log.data,
              topics: log.topics,
            });
          } catch {
            return undefined;
          }
        })
        .find(event => event?.eventName === "TaskCreated");

      const onChainTaskId = taskCreatedEvent?.args?.taskId;

      if (onChainTaskId === undefined) {
        throw new Error("Unable to obtain on-chain task ID");
      }

      const onChainTaskIdString = onChainTaskId.toString();

      const now = new Date();
      const endTime = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      const response = await fetch("/api/task", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...taskData,
          onChainTaskId: onChainTaskId?.toString(),
          startDate: now.toISOString(),
          endDate: endTime.toISOString(),
          creatorAddress: address,
          taskCount: parseInt(taskData.taskCount) || 0,
        }),
      });

      const data = await response.json();
      if (response.ok) {
        notification.success("Published successfully");
        router.push("/task/my-tasks");
      } else {
        notification.error(data.error || "Publishing failed");
      }
    } catch (error) {
      console.error("Publishing failed:", error);
      notification.error("Publishing failed: " + (error instanceof Error ? error.message : String(error)));
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setTaskData(prev => ({ ...prev, [name]: value }));

    setErrors(prev => ({ ...prev, [name]: "" }));

    if (name === "reward" || name === "taskCount") {
      calculateTotalReward(
        name === "reward" ? value : taskData.reward,
        name === "taskCount" ? value : taskData.taskCount,
      );
    }
  };

  const calculateTotalReward = (reward: string, count: string) => {
    const rewardNum = parseFloat(reward) || 0;
    const countNum = parseInt(count) || 0;
    setTotalReward((rewardNum * countNum).toFixed(0));
  };

  const handleDateChange = (date: dayjs.Dayjs | null, field: "startDate" | "endDate") => {
    setTaskData(prev => ({ ...prev, [field]: date ? date.format() : "" }));
    setErrors(prev => ({ ...prev, [field]: "" }));
  };

  const [isTaskTypeOpen, setIsTaskTypeOpen] = useState(false);
  const [isParticipationTypeOpen, setIsParticipationTypeOpen] = useState(false);

  const toggleTaskType = () => setIsTaskTypeOpen(!isTaskTypeOpen);
  const toggleParticipationType = () => setIsParticipationTypeOpen(!isParticipationTypeOpen);

  const selectTaskType = (value: string) => {
    setTaskData(prev => ({ ...prev, taskType: value }));
    setIsTaskTypeOpen(false);
  };

  const selectParticipationType = (value: string) => {
    const selectedOption = participationOptions.find(option => option.value === value);
    if (selectedOption) {
      setTaskData(prev => ({
        ...prev,
        participationType: value,
        reward: Math.max(Number(prev.reward), selectedOption.minReward).toString(),
      }));
    }
    setIsParticipationTypeOpen(false);
  };

  return (
    <ThemeProvider theme={darkTheme}>
      <LocalizationProvider dateAdapter={AdapterDayjs}>
        <div className="flex flex-col items-center justify-center bg-black text-white p-4 md:p-6 md:mt-10">
          <div className="border border-[#424242] bg-base-400 rounded-lg p-6 w-full max-w-3xl">
            <Link href="/task" className="inline-block mb-6">
              <ArrowLeftIcon className="h-6 w-6 text-white hover:text-primary" />
            </Link>
            <h1 className="text-3xl font-bold mb-6">Create task</h1>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="title" className="block text-sm font-medium text-gray-400 mb-2">
                  Task title
                </label>
                <input
                  type="text"
                  id="title"
                  name="title"
                  value={taskData.title}
                  onChange={handleChange}
                  className={`w-full text-white p-2 rounded-lg border ${
                    errors.title ? "border-red-500" : "border-[#424242]"
                  } bg-black focus:outline-none focus:ring-2 focus:ring-primary`}
                />
                {errors.title && <p className="text-red-500 text-sm mt-1">{errors.title}</p>}
              </div>

              <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-400 mb-2">
                  Task description
                </label>
                <textarea
                  id="description"
                  name="description"
                  value={taskData.description}
                  onChange={handleChange}
                  rows={6}
                  className={`w-full bg-black text-white p-2 rounded-lg border ${
                    errors.description ? "border-red-500" : "border-[#424242]"
                  } focus:outline-none focus:ring-2 focus:ring-primary`}
                ></textarea>
                {errors.description && <p className="text-red-500 text-sm mt-1">{errors.description}</p>}
              </div>

              <div className="flex space-x-4">
                <div className="flex-1">
                  <DatePicker
                    label="Start Date"
                    value={taskData.startDate ? dayjs(taskData.startDate) : null}
                    onChange={date => handleDateChange(date, "startDate")}
                    slotProps={{
                      textField: {
                        fullWidth: true,
                        error: !!errors.startDate,
                        helperText: errors.startDate,
                      },
                    }}
                    sx={{
                      "& .MuiInputBase-input": {
                        color: "white",
                      },
                      "& .MuiInputLabel-root": {
                        color: "#9ca3af",
                      },
                      "& .MuiInputLabel-root.Mui-focused": {
                        color: "#0d9488",
                      },
                      "& .MuiOutlinedInput-root": {
                        "& fieldset": {
                          borderColor: "#424242",
                        },
                        "&:hover fieldset": {
                          borderColor: "#4b5563",
                        },
                        "&.Mui-focused fieldset": {
                          borderColor: "#0d9488",
                        },
                      },
                      "& .MuiIconButton-root": {
                        color: "white",
                      },
                    }}
                  />
                </div>
                <div className="flex-1">
                  <DatePicker
                    label="End Date"
                    value={taskData.endDate ? dayjs(taskData.endDate) : null}
                    onChange={date => handleDateChange(date, "endDate")}
                    slotProps={{
                      textField: {
                        fullWidth: true,
                        error: !!errors.endDate,
                        helperText: errors.endDate,
                      },
                    }}
                    sx={{
                      "& .MuiInputBase-input": {
                        color: "white",
                      },
                      "& .MuiInputLabel-root": {
                        color: "#9ca3af",
                      },
                      "& .MuiInputLabel-root.Mui-focused": {
                        color: "#0d9488",
                      },
                      "& .MuiOutlinedInput-root": {
                        "& fieldset": {
                          borderColor: "#374151",
                        },
                        "&:hover fieldset": {
                          borderColor: "#4b5563",
                        },
                        "&.Mui-focused fieldset": {
                          borderColor: "#0d9488",
                        },
                      },
                      "& .MuiIconButton-root": {
                        color: "white",
                      },
                    }}
                  />
                </div>
              </div>

              {duration.days > 0 ? (
                <p className="text-sm text-gray-400">The task will continue {duration.days} days</p>
              ) : null}
              <div className="mb-4">
                <label htmlFor="taskType" className="block text-sm font-medium text-gray-400 mb-2">
                  Task type
                </label>
                <div className="relative">
                  <button
                    type="button"
                    className="w-full bg-black text-white p-2 rounded-lg border border-[#424242] focus:outline-none focus:ring-2 focus:ring-primary flex justify-between items-center"
                    onClick={toggleTaskType}
                  >
                    <span>{taskData.taskType === "individual" ? "Personal" : "Team"}</span>
                    <ChevronDownIcon className="h-5 w-5" />
                  </button>
                  {isTaskTypeOpen && (
                    <div className="absolute z-10 w-full mt-1 bg-black border border-[#424242] rounded-lg shadow-lg">
                      <div
                        className="p-2 hover:bg-gray-700 cursor-pointer"
                        onClick={() => selectTaskType("individual")}
                      >
                        Personal
                      </div>
                      <div className="p-2 hover:bg-gray-700 cursor-pointer" onClick={() => selectTaskType("team")}>
                        Team
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="mb-4">
                <label htmlFor="participationType" className="block text-sm font-medium text-gray-400 mb-2">
                  Task level
                </label>
                <div className="relative">
                  <button
                    type="button"
                    className="w-full bg-black text-white p-2 rounded-lg border border-[#424242] focus:outline-none focus:ring-2 focus:ring-primary flex justify-between items-center"
                    onClick={toggleParticipationType}
                  >
                    <span>
                      {participationOptions.find(option => option.value === taskData.participationType)?.label}
                    </span>
                    <ChevronDownIcon className="h-5 w-5" />
                  </button>
                  {isParticipationTypeOpen && (
                    <div className="absolute z-10 w-full mt-1 bg-black border border-[#424242] rounded-lg shadow-lg">
                      {participationOptions.map(option => (
                        <div
                          key={option.value}
                          className="p-2 hover:bg-gray-700 cursor-pointer"
                          onClick={() => selectParticipationType(option.value)}
                        >
                          {option.label} (Min {option.minReward} USDT)
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div>
                <label htmlFor="taskCount" className="block text-sm font-medium text-gray-400 mb-2">
                  Task Count
                </label>
                <input
                  type="number"
                  id="taskCount"
                  name="taskCount"
                  value={taskData.taskCount}
                  onChange={handleChange}
                  min="1"
                  step="1"
                  className="w-full bg-black text-white p-2 rounded-lg border border-[#424242] focus:outline-none focus:ring-2 focus:ring-primary [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  onWheel={e => e.currentTarget.blur()}
                />
              </div>
              <div>
                <label htmlFor="reward" className="block text-sm font-medium text-gray-400 mb-2">
                  Task Amount
                </label>
                <div className="relative flex items-center">
                  <Image
                    src="https://cryptologos.cc/logos/tether-usdt-logo.png"
                    alt="USDT"
                    width={20}
                    height={20}
                    className="absolute left-2"
                  />
                  <input
                    type="number"
                    id="reward"
                    name="reward"
                    value={taskData.reward}
                    onChange={handleChange}
                    onWheel={e => e.currentTarget.blur()}
                    min={participationOptions.find(option => option.value === taskData.participationType)?.minReward}
                    step="1"
                    autoComplete="off"
                    className="w-full bg-black text-white p-2 pl-8 rounded-lg border border-[#424242] focus:outline-none focus:ring-2 focus:ring-primary [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </div>
                {Number(taskData.reward) <
                  (participationOptions.find(option => option.value === taskData.participationType)?.minReward ||
                    0) && (
                  <p className="text-red-500 text-sm mt-1">
                    Min: {participationOptions.find(option => option.value === taskData.participationType)?.minReward}{" "}
                    USDT
                  </p>
                )}
                {taskData.reward && taskData.taskCount && (
                  <p className="text-sm text-gray-400 mt-2">Total reward required:{totalReward} USDT</p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    <div className="flex items-center gap-2">
                      <FaXTwitter className="text-xl" />
                      <span>Twitter Account</span>
                    </div>
                  </label>
                  <input
                    type="text"
                    name="twitterAccount"
                    value={taskData.twitterAccount}
                    onChange={handleChange}
                    placeholder="@your_twitter"
                    className="mt-1 block w-full rounded-md border border-[#424242] bg-black px-3 py-2 text-white shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary sm:text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    <div className="flex items-center gap-2">
                      <FaPaperPlane className="text-xl" />
                      <span>Telegram Account</span>
                    </div>
                  </label>
                  <input
                    type="text"
                    name="telegramAccount"
                    value={taskData.telegramAccount}
                    onChange={handleChange}
                    placeholder="@your_telegram"
                    className="mt-1 block w-full rounded-md border border-[#424242] bg-black px-3 py-2 text-white shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary sm:text-sm"
                  />
                </div>
              </div>
              {!isConnected ? (
                <RainbowKitCustomConnectButton />
              ) : (
                <button
                  type="submit"
                  className="w-full bg-primary hover:bg-opacity-80 text-white py-3 rounded-lg font-semibold cursor-pointer transition-colors duration-200"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <div className="flex items-center justify-center">
                      <Loading size="sm" color="primary" className="mr-2" />
                      Creating...
                    </div>
                  ) : (
                    "Create Task"
                  )}
                </button>
              )}
            </form>
          </div>
        </div>
      </LocalizationProvider>
    </ThemeProvider>
  );
};

export default CreateTaskPage;
