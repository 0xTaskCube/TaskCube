"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import ParticlesComponent from "../../components/ui/ParticlesComponent";
import { isAddress } from "ethers";
import { ChevronRight } from "lucide-react";
import { useAccount } from "wagmi";
import { RainbowKitCustomConnectButton } from "~~/components/scaffold-eth";

interface ConnectionStepProps {
  number: string;
  label: string;
  title: string;
  description: string;
  action: React.ReactNode;
}

const ConnectionStep: React.FC<ConnectionStepProps> = ({ number, label, title, description, action }) => (
  <div className="flex flex-col sm:flex-row items-start border border-[#424242] bg-base-400 p-4 rounded-lg">
    <div className="flex-shrink-0 w-16 h-16 sm:w-24 sm:h-24 bg-custom-hover rounded-lg flex flex-col items-center justify-center mb-4 sm:mb-0 sm:mr-4">
      <span className="text-2xl sm:text-4xl font-bold mb-2">{number}</span>
      <span className="text-xs sm:text-sm">{label}</span>
    </div>
    <div className="flex-grow flex flex-col sm:flex-row justify-between items-start sm:items-center w-full">
      <div className="mb-4 sm:mb-0">
        <h2 className="text-lg sm:text-xl font-semibold mb-1">{title}</h2>
        <p className="text-gray-400 text-sm sm:text-base">{description}</p>
      </div>
      <div className="w-full sm:w-auto sm:ml-4 mt-2 sm:mt-0">{action}</div>
    </div>
  </div>
);

const StartPage: React.FC = () => {
  const { isConnected, address } = useAccount();
  const router = useRouter();
  const [inviterCode, setInviterCode] = useState("");
  const [isInviterValid, setIsInviterValid] = useState(true);
  const [walletError, setWalletError] = useState(false);
  const [inviterError, setInviterError] = useState(false);
  const [isInviterLocked, setIsInviterLocked] = useState(false);
  const [selfInviteError, setSelfInviteError] = useState(false);
  const [alreadyInvitedError, setAlreadyInvitedError] = useState(false);
  const [isStartButtonEnabled, setIsStartButtonEnabled] = useState(false);

  // 检查被邀请状态
  const checkInviteeStatus = async () => {
    if (!isConnected || !address) return;

    console.log("检查被邀请状态:", address);
    try {
      const response = await fetch(`/api/invites?invitee=${address}`);
      const data = await response.json();
      console.log("被邀请状态响应:", data);

      if (data.status === "invited") {
        console.log("用户已被邀请");
        setIsStartButtonEnabled(true);
        setIsInviterLocked(true);
        setInviterCode(data.inviter);
      } else {
        console.log("用户未被邀请");
        setIsStartButtonEnabled(false);
        setIsInviterLocked(false);
        setInviterCode("");
      }
    } catch (error) {
      console.error("检查被邀请状态失败:", error);
    }
  };

  // 处理邀请关系
  useEffect(() => {
    const handleInvitation = async () => {
      if (!isConnected || !address) return;

      console.log("处理邀请关系:", { isConnected, address });

      // 1. 先从当前 URL 获取 inviter 参数
      const urlParams = new URLSearchParams(window.location.search);
      let inviter = urlParams.get("inviter");

      // 2. 如果当前 URL 没有，尝试从根页面的 URL 获取
      if (!inviter && typeof window !== "undefined") {
        const rootParams = new URLSearchParams(document.referrer.split("?")[1] || "");
        inviter = rootParams.get("inviter");
      }

      console.log("获取到的邀请人:", inviter);

      if (inviter) {
        await checkAndSetInviter(inviter);
      } else {
        await checkInviteeStatus();
      }
    };

    handleInvitation();
  }, [isConnected, address]);
  // 检查并设置邀请人
  const checkAndSetInviter = async (inviter: string) => {
    if (!address) return;

    console.log("检查邀请状态:", { inviter, address });
    try {
      const response = await fetch(`/api/invites?invitee=${address}`);
      const data = await response.json();
      console.log("检查邀请响应:", data);

      if (data.status === "invited") {
        console.log("用户已被邀请，显示实际邀请人");
        setInviterCode(data.inviter);
        setIsInviterLocked(true);
        setIsStartButtonEnabled(true);
      } else if (inviter.toLowerCase() === address.toLowerCase()) {
        console.log("不能邀请自己");
        setSelfInviteError(true);
      } else {
        console.log("保存新的邀请关系");
        await saveInvitation(inviter, address);
      }
    } catch (error) {
      console.error("检查邀请状态失败:", error);
      setInviterError(true);
    }
  };

  // 保存邀请关系
  const saveInvitation = async (inviter: string, invitee: string) => {
    console.log("保存邀请关系:", { inviter, invitee });
    try {
      const response = await fetch("/api/invites", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ inviter, invitee }),
      });

      const data = await response.json();
      console.log("保存邀请响应:", data);

      if (data.status === "success") {
        console.log("邀请保存成功");
        setInviterCode(inviter);
        setIsInviterLocked(true);
        setIsStartButtonEnabled(true);
        setInviterError(false);
        setAlreadyInvitedError(false);
      } else {
        console.error("保存邀请失败:", data.message);
        if (data.message.includes("已经被邀请过")) {
          setAlreadyInvitedError(true);
          await checkInviteeStatus(); // 获取实际的邀请者
        } else {
          setInviterError(true);
        }
      }
    } catch (error) {
      console.error("保存邀请数据时出错:", error);
      setInviterError(true);
    }
  };

  // 处理邀请码输入
  const handleInviterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const code = e.target.value;
    setInviterCode(code);

    if (isAddress(code)) {
      if (code.toLowerCase() === address?.toLowerCase()) {
        setIsInviterValid(false);
        setSelfInviteError(true);
      } else {
        setIsInviterValid(true);
        setSelfInviteError(false);
      }
      setInviterError(false);
      setAlreadyInvitedError(false);
    } else {
      setIsInviterValid(false);
      setSelfInviteError(false);
    }
  };

  // 锁定邀请码
  const handleLockInviter = async () => {
    if (!isInviterValid || !inviterCode.trim() || selfInviteError || !address) return;

    console.log("锁定邀请码:", inviterCode);
    setIsInviterLocked(true);

    try {
      await saveInvitation(inviterCode, address);
    } catch (error) {
      console.error("锁定邀请码失败:", error);
      setInviterError(true);
      setIsInviterLocked(false);
    }
  };

  // 开始任务
  const handleStartJourney = () => {
    if (!isConnected) {
      setWalletError(true);
      return;
    }

    // 只在用户输入了无效邀请码时显示错误
    if (inviterCode.trim() && (!isInviterValid || selfInviteError)) {
      setInviterError(true);
      return;
    }

    console.log("开始任务");
    router.push("/dashboard");
  };

  return (
    <>
      <ParticlesComponent />
      <div className="bg-black text-white flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-3xl rounded-lg p-4 sm:p-8 shadow-lg">
          <Image src="/logo.png" alt="Logo" width={48} height={48} className="mb-6" />
          <h1 className="text-3xl sm:text-4xl font-bold mb-2">Start TaskCube</h1>
          <p className="text-gray-400 mb-4 sm:mb-6 text-sm sm:text-base">
            Pilot your missions and claim your rewards by adding your connections.
          </p>
          <p className="text-xs sm:text-sm text-gray-500 italic mb-6 sm:mb-8">
            Psst...already have an account? Connect wallet to log in and enter the portal!
          </p>

          <div className="space-y-4 sm:space-y-6">
            <ConnectionStep
              number="01"
              label="Wallet"
              title="Connect Your Wallet"
              description="The address to connect to the EVM network."
              action={
                <div className="w-full sm:w-auto py-2 px-4 rounded-lg transition-colors text-sm sm:text-base">
                  <RainbowKitCustomConnectButton />
                </div>
              }
            />
            {walletError && <p className="text-red-500">请连接钱包</p>}

            <ConnectionStep
              number="02"
              label="Inviter"
              title="Inviter Code"
              description="Enter the inviter's wallet address to start the bounty task."
              action={
                <div className="flex w-full sm:w-auto">
                  <input
                    type="text"
                    placeholder="<inviter address>"
                    className={`flex-grow sm:flex-grow-0 mr-2 ${
                      isInviterLocked ? "bg-custom-hover" : "bg-custom-hover"
                    } text-white rounded-lg pl-4 pr-4 py-2 text-sm sm:text-base ${
                      isInviterValid && !selfInviteError && !inviterError && !alreadyInvitedError
                        ? ""
                        : "border-red-500"
                    }`}
                    value={inviterCode}
                    onChange={handleInviterChange}
                    disabled={isInviterLocked}
                  />
                  <button
                    onClick={handleLockInviter}
                    disabled={!isInviterValid || selfInviteError || isInviterLocked}
                    className="bg-primary hover:bg-opacity-80 text-white p-2 rounded-lg transition-colors disabled:opacity-50"
                  >
                    <ChevronRight size={20} />
                  </button>
                </div>
              }
            />
            {selfInviteError && <p className="text-red-500">You cannot invite yourself</p>}
            {inviterError && <p className="text-red-500">Invalid inviter code</p>}
            {alreadyInvitedError && <p className="text-red-500">This address has already been invited</p>}
          </div>

          <button
            onClick={handleStartJourney}
            // 修改 disabled 属性的类型
            disabled={Boolean(alreadyInvitedError || selfInviteError || (inviterCode.trim() && !isInviterValid))}
            className={`block w-full mt-6 sm:mt-8 ${
              alreadyInvitedError || selfInviteError || (inviterCode.trim() && !isInviterValid)
                ? "bg-custom-hover"
                : "bg-primary"
            } hover:bg-opacity-80 text-white py-3 rounded-lg transition-colors text-sm sm:text-base text-center`}
          >
            Start the journey
          </button>
        </div>
      </div>
    </>
  );
};

export default StartPage;
