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
import { useAccount } from "wagmi";
import { ArrowLeftIcon, ChevronDownIcon } from "@heroicons/react/24/outline";
import { RainbowKitCustomConnectButton } from "~~/components/scaffold-eth";
import { notification } from "~~/utils/scaffold-eth";

const darkTheme = createTheme({
  palette: {
    mode: "dark",
  },
});

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
    taskType: "individual",
    participationType: "Initiate", // 默认设置为最低级的 Initiate
    specificAddresses: "",
  });
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
    if (!taskData.title.trim()) newErrors.title = "请输入正确的标题";
    if (!taskData.description.trim()) newErrors.description = "请输入任务描述";
    if (!taskData.startDate) newErrors.startDate = "请选择开始日期";
    if (!taskData.endDate) newErrors.endDate = "请选择结束日期";
    if (!taskData.reward.trim()) newErrors.reward = "请输入奖金金额";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConnected) {
      notification.error("请先连接钱包");
      return;
    }

    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch("/api/task", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...taskData,
          creatorAddress: address,
        }),
      });
      const data = await response.json();
      if (response.ok) {
        notification.success("任务发布成功");
        router.push("/task/my-tasks");
      } else {
        throw new Error(data.message || "发布任务失败");
      }
    } catch (error) {
      console.error("发布任务失败:", error);
      notification.error("发布任务失败: " + (error as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setTaskData(prev => ({ ...prev, [name]: value }));
    // 清除对应字段的错误
    setErrors(prev => ({ ...prev, [name]: "" }));
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

  const handleRewardChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newReward = e.target.value;
    setTaskData(prev => ({ ...prev, reward: newReward }));
  };

  return (
    <ThemeProvider theme={darkTheme}>
      <LocalizationProvider dateAdapter={AdapterDayjs}>
        <div className="flex flex-col items-center justify-center bg-black text-white p-4 md:p-6 md:mt-10">
          <div className="border border-[#424242] bg-base-400 rounded-lg p-6 w-full max-w-3xl">
            <Link href="/task" className="inline-block mb-6">
              <ArrowLeftIcon className="h-6 w-6 text-white hover:text-primary" />
            </Link>
            <h1 className="text-3xl font-bold mb-6">发布新任务</h1>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="title" className="block text-sm font-medium text-gray-400 mb-2">
                  任务标题
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
                  任务描述
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
                        color: "white", // 输入框文字颜色
                      },
                      "& .MuiInputLabel-root": {
                        color: "#9ca3af", // 未选中时的标签颜色 (text-gray-400)
                      },
                      "& .MuiInputLabel-root.Mui-focused": {
                        color: "#0d9488", // 选中时的标签颜色
                      },
                      "& .MuiOutlinedInput-root": {
                        "& fieldset": {
                          borderColor: "#424242", // 默认边框颜色 (border-gray-700)
                        },
                        "&:hover fieldset": {
                          borderColor: "#4b5563", // 悬停时的边框颜色 (border-gray-600)
                        },
                        "&.Mui-focused fieldset": {
                          borderColor: "#0d9488", // 聚焦时的边框颜色
                        },
                      },
                      "& .MuiIconButton-root": {
                        color: "white", // 日历图标颜色
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
                        color: "white", // 输入框文字颜色
                      },
                      "& .MuiInputLabel-root": {
                        color: "#9ca3af", // 未选中时的标签颜色 (text-gray-400)
                      },
                      "& .MuiInputLabel-root.Mui-focused": {
                        color: "#0d9488", // 选中时的标签颜色
                      },
                      "& .MuiOutlinedInput-root": {
                        "& fieldset": {
                          borderColor: "#374151", // 默认边框颜色 (border-gray-700)
                        },
                        "&:hover fieldset": {
                          borderColor: "#4b5563", // 悬停时的边框颜色 (border-gray-600)
                        },
                        "&.Mui-focused fieldset": {
                          borderColor: "#0d9488", // 聚焦时的边框颜色
                        },
                      },
                      "& .MuiIconButton-root": {
                        color: "white", // 日历图标颜色
                      },
                    }}
                  />
                </div>
              </div>

              {duration.days > 0 ? <p className="text-sm text-gray-400">此任务将持续 {duration.days} 天</p> : null}
              <div className="mb-4">
                <label htmlFor="taskType" className="block text-sm font-medium text-gray-400 mb-2">
                  任务类型
                </label>
                <div className="relative">
                  <button
                    type="button"
                    className="w-full bg-black text-white p-2 rounded-lg border border-[#424242] focus:outline-none focus:ring-2 focus:ring-primary flex justify-between items-center"
                    onClick={toggleTaskType}
                  >
                    <span>{taskData.taskType === "individual" ? "个人任务" : "团队任务"}</span>
                    <ChevronDownIcon className="h-5 w-5" />
                  </button>
                  {isTaskTypeOpen && (
                    <div className="absolute z-10 w-full mt-1 bg-black border border-[#424242] rounded-lg shadow-lg">
                      <div
                        className="p-2 hover:bg-gray-700 cursor-pointer"
                        onClick={() => selectTaskType("individual")}
                      >
                        个人任务
                      </div>
                      <div className="p-2 hover:bg-gray-700 cursor-pointer" onClick={() => selectTaskType("team")}>
                        团队任务
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="mb-4">
                <label htmlFor="participationType" className="block text-sm font-medium text-gray-400 mb-2">
                  参与资格
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
                          {option.label} (最低 {option.minReward} USDT)
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label htmlFor="reward" className="block text-sm font-medium text-gray-400 mb-2">
                  奖金 (USDT)
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
                    onChange={handleRewardChange}
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
                    最低奖金金额为{" "}
                    {participationOptions.find(option => option.value === taskData.participationType)?.minReward} USDT
                  </p>
                )}
              </div>
              {!isConnected ? (
                <RainbowKitCustomConnectButton />
              ) : (
                <button
                  type="submit"
                  className="w-full bg-primary hover:bg-opacity-80 text-white py-3 rounded-lg font-semibold cursor-pointer transition-colors duration-200"
                  disabled={isLoading}
                >
                  {isLoading ? "发布中..." : "发布任务"}
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
