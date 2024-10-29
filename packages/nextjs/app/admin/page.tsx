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
  date: string;
  status: string;
  isLoading: boolean;
  contractRequestId?: string;
}

interface ClaimRequest {
  _id: string;
  userAddress: string;
  amount: string;
  bountyId: string;
  taskId: string;
  contractRequestId: string; // 确保使用正确的字段名
  status: string;
  date: string;
  isLoading: boolean;
  transactionHash?: string;
}

const AdminPage = () => {
  const [selectedRequests, setSelectedRequests] = useState<string[]>([]);
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const [withdrawalRequests, setWithdrawalRequests] = useState<WithdrawalRequest[]>([]);
  const [claimRequests, setClaimRequests] = useState<ClaimRequest[]>([]);
  const [activeTab, setActiveTab] = useState<"withdrawals" | "claims">("withdrawals");
  const publicClient = usePublicClient();

  const { data: depositWithdrawContract, isLoading: isContractLoading } = useScaffoldContract({
    contractName: "DepositWithdraw",
    walletClient,
  });

  const fetchWithdrawalRequests = useCallback(async () => {
    if (address && address.toLowerCase() === ADMIN_ADDRESS.toLowerCase()) {
      try {
        const response = await fetch(`/api/admin?userAddress=${address}`);
        if (!response.ok) {
          throw new Error(`API 请求失败: ${response.status}`);
        }
        const data = await response.json();
        if (data.success && Array.isArray(data.requests)) {
          const formattedRequests = data.requests.map((request: any) => ({
            ...request,
            isLoading: false,
          }));
          setWithdrawalRequests(formattedRequests);
        }
      } catch (error) {
        console.error("获取提现请求失败:", error);
        notification.error("获取提现请求失败: " + (error instanceof Error ? error.message : String(error)));
      }
    }
  }, [address]);

  const fetchClaimRequests = useCallback(async () => {
    if (address) {
      try {
        const response = await fetch(`/api/admin?userAddress=${address}&type=claims`);
        if (!response.ok) {
          throw new Error(`API 请求失败: ${response.status}`);
        }
        const data = await response.json();
        if (data.success && data.claims) {
          const formattedClaims = data.claims.map((claim: any) => ({
            _id: claim._id,
            userAddress: claim.userAddress,
            amount: claim.amount,
            taskId: claim.taskId,
            bountyId: claim.bountyId || "",
            status: claim.status || "pending",
            isLoading: false,
            contractRequestId: claim.contractRequestId, // 改为 contractRequestId
            transactionHash: claim.transactionHash,
            date: claim.date,
          }));
          console.log("获取到的领取申请:", formattedClaims);
          setClaimRequests(formattedClaims);
        }
      } catch (error) {
        console.error("获取领取申请失败:", error);
        notification.error("获取领取申请失败: " + (error instanceof Error ? error.message : String(error)));
      }
    }
  }, [address]);

  const checkContractState = useCallback(async () => {
    if (!depositWithdrawContract || !publicClient) {
      notification.error("合约未初始化");
      return;
    }
    try {
      notification.info("正在检查合约状态...");
      const paused = await depositWithdrawContract.read.paused();
      notification.success(`合约状态: ${paused ? "已暂停" : "运行中"}`);
    } catch (error) {
      console.error("检查合约状态失败:", error);
      notification.error("检查合约状态失败");
    }
  }, [depositWithdrawContract, publicClient]);

  const handleApprove = useCallback(
    async (requestIds: string[]) => {
      if (!requestIds || requestIds.length === 0) {
        notification.error("没有选择要批准的请求");
        return;
      }

      setWithdrawalRequests(prevRequests =>
        prevRequests.map(request => (requestIds.includes(request._id) ? { ...request, isLoading: true } : request)),
      );

      try {
        notification.info("正在处理提现请求...");
        const response = await fetch(`/api/admin?userAddress=${address}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ contractRequestIds: requestIds }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "处理提现请求失败");
        }

        const result = await response.json();
        notification.success(result.message);
        await fetchWithdrawalRequests();
      } catch (error) {
        console.error("处理提现请求失败:", error);
        notification.error("处理提现请求失败: " + (error instanceof Error ? error.message : String(error)));
      } finally {
        setWithdrawalRequests(prevRequests =>
          prevRequests.map(request => (requestIds.includes(request._id) ? { ...request, isLoading: false } : request)),
        );
      }
    },
    [address, fetchWithdrawalRequests],
  );

  const handleApproveClaims = useCallback(
    async (claimIds: string[]) => {
      if (!claimIds || claimIds.length === 0) {
        notification.error("没有选择要批准的领取申请");
        return;
      }

      // 检查选中的申请是否都有 contractRequestId
      const selectedClaims = claimRequests.filter(claim => claimIds.includes(claim._id));
      console.log("选中的申请:", selectedClaims); // 添加日志
      const invalidClaims = selectedClaims.filter(claim => !claim.contractRequestId);

      if (invalidClaims.length > 0) {
        console.error("缺少 contractRequestId 的申请:", invalidClaims);
        notification.error("部分申请缺少必要的合约信息");
        return;
      }

      setClaimRequests(prevClaims =>
        prevClaims.map(claim => (claimIds.includes(claim._id) ? { ...claim, isLoading: true } : claim)),
      );

      try {
        notification.info("正在批准领取申请...");
        const response = await fetch(`/api/admin?userAddress=${address}&type=claims`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ claimIds }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "批准领取申请失败");
        }

        const result = await response.json();
        notification.success(result.message);
        await fetchClaimRequests();
      } catch (error) {
        console.error("处理批准领取申请时出错:", error);
        notification.error("处理批准领取申请时出错: " + (error instanceof Error ? error.message : String(error)));
      } finally {
        setClaimRequests(prevClaims =>
          prevClaims.map(claim => (claimIds.includes(claim._id) ? { ...claim, isLoading: false } : claim)),
        );
      }
    },
    [address, fetchClaimRequests, claimRequests],
  );

  const handleBatchApprove = useCallback(() => {
    if (activeTab === "withdrawals") {
      handleApprove(selectedRequests);
    } else {
      handleApproveClaims(selectedRequests);
    }
  }, [activeTab, selectedRequests, handleApprove, handleApproveClaims]);

  // 2. 修改 useEffect，添加自动刷新
  useEffect(() => {
    if (address) {
      fetchWithdrawalRequests();
      fetchClaimRequests();
    }
  }, [address, fetchWithdrawalRequests, fetchClaimRequests]);

  if (!isConnected) {
    return <div className="container mx-auto p-4">请先连接钱包</div>;
  }

  if (address?.toLowerCase() !== ADMIN_ADDRESS.toLowerCase()) {
    return <div className="container mx-auto p-4">您没有权限访问此页面</div>;
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold my-4">管理员页面</h1>
      <div className="flex space-x-4 mb-4">
        <button
          onClick={() => setActiveTab("withdrawals")}
          className={`py-2 px-4 rounded ${activeTab === "withdrawals" ? "bg-blue-500 text-white" : "bg-gray-300"}`}
        >
          提现请求
        </button>
        <button
          onClick={() => setActiveTab("claims")}
          className={`py-2 px-4 rounded ${activeTab === "claims" ? "bg-blue-500 text-white" : "bg-primary"}`}
        >
          领取申请
        </button>
      </div>

      {activeTab === "withdrawals" ? (
        <div>
          {withdrawalRequests.length === 0 ? (
            <p className="text-lg text-gray-200">目前没有待处理的提现请求</p>
          ) : (
            <>
              <button
                onClick={checkContractState}
                className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded mb-4 mr-4"
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
      ) : (
        <div>
          {claimRequests.length === 0 ? (
            <p className="text-lg text-gray-200">目前没有待处理的领取申请</p>
          ) : (
            <>
              <button
                onClick={handleBatchApprove}
                className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded mb-4"
                disabled={selectedRequests.length === 0}
              >
                批量审批领取申请 ({selectedRequests.length})
              </button>
              <table className="min-w-full bg-base-400 text-white">
                <thead>
                  <tr>
                    <th className="py-2 border-b text-center">选择</th>
                    <th className="py-2 border-b text-center">申请ID</th>
                    <th className="py-2 border-b text-center">用户地址</th>
                    <th className="py-2 px-4 border-b text-center">金额</th>
                    <th className="py-2 px-4 border-b text-center">任务ID</th>
                    <th className="py-2 px-4 border-b text-center">状态</th>
                    <th className="py-2 px-4 border-b text-center">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {claimRequests.map(claim => (
                    <tr key={claim._id}>
                      <td className="py-2 px-4 border-b text-center">
                        <input
                          type="checkbox"
                          checked={selectedRequests.includes(claim._id)}
                          onChange={e => {
                            if (e.target.checked) {
                              setSelectedRequests(prev => [...prev, claim._id]);
                            } else {
                              setSelectedRequests(prev => prev.filter(id => id !== claim._id));
                            }
                          }}
                          disabled={claim.status === "Approved"}
                        />
                      </td>
                      <td className="py-2 px-4 border-b text-center">{claim._id}</td>
                      <td className="py-2 px-4 border-b text-center">{claim.userAddress}</td>
                      <td className="py-2 px-4 border-b text-center">{claim.amount}</td>
                      <td className="py-2 px-4 border-b text-center">{claim.taskId}</td>
                      <td className="py-2 px-4 border-b text-center">
                        <span
                          className={`${
                            claim.status.toLowerCase() === "executed" || claim.status.toLowerCase() === "approved"
                              ? "text-primary"
                              : ""
                          }`}
                        >
                          {claim.status || "未知"}
                        </span>
                      </td>
                      <td className="py-2 px-4 border-b text-center">
                        <button
                          onClick={() => handleApproveClaims([claim._id])}
                          className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
                          disabled={claim.isLoading || claim.status === "Approved"}
                        >
                          {claim.isLoading ? "处理中..." : claim.status === "Approved" ? "已批准" : "批准"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default AdminPage;
