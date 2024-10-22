"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";
import { useScaffoldContract } from "~~/hooks/scaffold-eth";
import { notification } from "~~/utils/scaffold-eth";

const ADMIN_ADDRESS = "0xB1CD9f3c65496ddD185F81d5E5b0BC9004535521";

interface WithdrawalRequest {
  _id: string;
  userAddress: string;
  amount: string;
  // type: string;
  date: string;
  status: string;
  isLoading: boolean;
  contractRequestId?: string;
}

const AdminPage = () => {
  const [selectedRequests, setSelectedRequests] = useState<string[]>([]);
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const [withdrawalRequests, setWithdrawalRequests] = useState<WithdrawalRequest[]>([]);
  const publicClient = usePublicClient();
  const { data: depositWithdrawContract, isLoading: isContractLoading } = useScaffoldContract({
    contractName: "DepositWithdraw",
    walletClient,
  });

  const checkContractState = useCallback(async () => {
    if (depositWithdrawContract && publicClient) {
      try {
        const state = await publicClient.readContract({
          address: depositWithdrawContract.address as `0x${string}`,
          abi: depositWithdrawContract.abi,
          functionName: "getContractState" as any,
        });
        console.log("Contract state:", state);

        if (Array.isArray(state) && state.length === 4) {
          const [nextRequestId, lastCleanup, withdrawalExpiration, contractBalance] = state;
          notification.info(`合约状态: 
            下一个请求ID: ${nextRequestId.toString()}, 
            最后清理时间: ${new Date(Number(lastCleanup) * 1000).toLocaleString()}, 
            提款过期时间: ${Number(withdrawalExpiration) / 3600}小时, 
            合约余额: ${contractBalance.toString()} (wei)`);
        } else {
          notification.warning("合约状态格式不正确");
        }

        const isValid = await publicClient.readContract({
          address: depositWithdrawContract.address as `0x${string}`,
          abi: depositWithdrawContract.abi,
          functionName: "verifyUSDTContract" as any,
        });
        if (!isValid) {
          notification.error("USDT 合约地址可能不正确");
        } else {
          notification.success("USDT 合约地址验证成功");
        }
      } catch (error) {
        console.error("检查合约状态时出错:", error);
        notification.error("检查合约状态时出错: " + (error instanceof Error ? error.message : String(error)));
      }
    } else {
      notification.error("合约或客户端未准备就绪");
    }
  }, [depositWithdrawContract, publicClient]);

  const fetchWithdrawalRequests = useCallback(async () => {
    if (address && address.toLowerCase() === ADMIN_ADDRESS.toLowerCase()) {
      console.log("正在获取提现请求...");
      try {
        const response = await fetch(`/api/admin?userAddress=${address}`);
        if (!response.ok) {
          throw new Error(`API 请求失败: ${response.status}`);
        }
        const data = await response.json();
        if (data.success && Array.isArray(data.requests)) {
          const formattedRequests = data.requests.map((request: any) => ({
            ...request,
            amount: request.amount.toString(),
            isLoading: false,
            status: request.status || "Pending",
          }));
          console.log("Formatted requests:", formattedRequests);
          setWithdrawalRequests(formattedRequests);
        } else {
          throw new Error(data.error || "数据格式不正确");
        }
      } catch (error) {
        console.error("获取提现请求时出错:", error);
        notification.error("获取提现请求失败: " + (error instanceof Error ? error.message : String(error)));
      }
    }
  }, [address]);

  useEffect(() => {
    if (isConnected && address && address.toLowerCase() === ADMIN_ADDRESS.toLowerCase()) {
      fetchWithdrawalRequests();
    }
  }, [isConnected, address, fetchWithdrawalRequests]);

  const handleApprove = useCallback(
    async (requestIds: string[]) => {
      console.log("Received requestIds:", requestIds);

      if (!requestIds || requestIds.length === 0) {
        notification.error("没有选择要批准的请求");
        return;
      }
      if (isContractLoading || !depositWithdrawContract || !walletClient || !publicClient) {
        notification.error("合约或客户端未准备就绪");
        return;
      }

      setWithdrawalRequests(prevRequests =>
        prevRequests.map(req => (requestIds.includes(req._id) ? { ...req, isLoading: true } : req)),
      );

      try {
        notification.info("正在批准提现请求...");

        // 获取选中请求的完整信息
        const selectedRequests = withdrawalRequests.filter(req => requestIds.includes(req._id));
        const contractRequestIds = selectedRequests.map(req => req.contractRequestId).filter(Boolean);

        if (contractRequestIds.length === 0) {
          throw new Error("没有有效的合约请求 ID");
        }

        // 调用后端 API 来处理批准请求，传递 contractRequestIds
        const response = await fetch(`/api/admin?userAddress=${address}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ contractRequestIds }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "批准请求失败");
        }

        const result = await response.json();
        console.log("API response:", result);
        notification.success(result.message);

        // 刷新提现请求列表
        await fetchWithdrawalRequests();
      } catch (error) {
        console.error("处理批准请求时出错:", error);
        notification.error("处理批准请求时出错: " + (error instanceof Error ? error.message : String(error)));
      } finally {
        setWithdrawalRequests(prevRequests =>
          prevRequests.map(req => (requestIds.includes(req._id) ? { ...req, isLoading: false } : req)),
        );
      }
    },
    [
      address,
      depositWithdrawContract,
      isContractLoading,
      fetchWithdrawalRequests,
      publicClient,
      walletClient,
      withdrawalRequests,
    ],
  );

  const handleBatchApprove = useCallback(() => {
    console.log("Batch approve selectedRequests:", selectedRequests);

    if (selectedRequests.length > 0) {
      handleApprove(selectedRequests);
      setSelectedRequests([]);
    } else {
      notification.warning("请先选择要批准的请求");
    }
  }, [selectedRequests, handleApprove]);

  if (!isConnected) {
    return <div className="container mx-auto p-4">请先连接钱包</div>;
  }

  if (address?.toLowerCase() !== ADMIN_ADDRESS.toLowerCase()) {
    return <div className="container mx-auto p-4">您没有权限访问此页面</div>;
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold my-4">管理员页面 - 提现请求</h1>
      {withdrawalRequests.length === 0 ? (
        <p className="text-lg text-gray-200">目前没有待处理的提现请求</p>
      ) : (
        <>
          <button
            onClick={checkContractState}
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded mb-4"
          >
            检查合约状态
          </button>
          <button
            onClick={handleBatchApprove}
            className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded mb-4"
            disabled={selectedRequests.length === 0}
          >
            批量审批 ({selectedRequests.length})
          </button>
          <table className="min-w-full bg-base-400 text-white">
            <thead>
              <tr>
                <th className="py-2 border-b text-center">选择</th>
                <th className="py-2 border-b text-center">请求ID</th>
                <th className="py-2 border-b text-center">用户地址</th>
                <th className="py-2 px-4 border-b text-center">金额</th>
                <th className="py-2 px-4 border-b text-center">代币</th>
                <th className="py-2 px-4 border-b text-center">日期</th>
                <th className="py-2 px-4 border-b text-center">状态</th>
                <th className="py-2 px-4 border-b text-center">操作</th>
              </tr>
            </thead>
            <tbody>
              {withdrawalRequests.map(request => (
                <tr key={request._id}>
                  <td className="py-2 px-4 border-b text-center">
                    <input
                      type="checkbox"
                      checked={selectedRequests.includes(request._id)}
                      onChange={e => {
                        if (e.target.checked) {
                          setSelectedRequests(prev => [...prev, request._id]);
                        } else {
                          setSelectedRequests(prev => prev.filter(id => id !== request._id));
                        }
                      }}
                      disabled={request.status === "Approved"}
                    />
                  </td>
                  <td className="py-2 px-4 border-b text-center">{request.contractRequestId || "N/A"}</td>
                  <td className="py-2 px-4 border-b text-center">{request.userAddress}</td>
                  <td className="py-2 px-4 border-b text-center">{request.amount}</td>
                  <td className="py-2 px-4 border-b text-center">USDT</td>
                  <td className="py-2 px-4 border-b text-center">{new Date(request.date).toLocaleString()}</td>
                  <td className="py-2 px-4 border-b text-center">
                    <span
                      className={`${
                        request.status.toLowerCase() === "executed" || request.status.toLowerCase() === "approved"
                          ? "text-primary"
                          : ""
                      }`}
                    >
                      {request.status || "未知"}
                    </span>
                  </td>
                  <td className="py-2 px-4 border-b text-center">
                    <button
                      onClick={() => handleApprove([request._id])}
                      className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
                      disabled={request.isLoading || request.status === "Approved"}
                    >
                      {request.isLoading ? "处理中..." : request.status === "Approved" ? "已批准" : "批准"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
};

export default AdminPage;
