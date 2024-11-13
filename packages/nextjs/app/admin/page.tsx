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
  contractRequestId: string;
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
          throw new Error(`API Request failed: ${response.status}`);
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
        console.error("Failed to obtain withdrawal request:", error);
        notification.error(
          "Failed to obtain withdrawal request: " + (error instanceof Error ? error.message : String(error)),
        );
      }
    }
  }, [address]);

  const fetchClaimRequests = useCallback(async () => {
    if (address) {
      try {
        const response = await fetch(`/api/admin?userAddress=${address}&type=claims`);
        if (!response.ok) {
          throw new Error(`API Request failed: ${response.status}`);
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
            contractRequestId: claim.contractRequestId,
            transactionHash: claim.transactionHash,
            date: claim.date,
          }));
          setClaimRequests(formattedClaims);
        }
      } catch (error) {
        notification.error(
          "Failed to obtain the application: " + (error instanceof Error ? error.message : String(error)),
        );
      }
    }
  }, [address]);

  const checkContractState = useCallback(async () => {
    if (!depositWithdrawContract || !publicClient) {
      notification.error("The contract is not initialized");
      return;
    }
    try {
      notification.info("Checking contract status...");
      const paused = await depositWithdrawContract.read.paused();
      notification.success(`Contract status: ${paused ? "Suspended" : "Running"}`);
    } catch (error) {
      console.error("Failed to check contract status:", error);
      notification.error("Failed to check contract status");
    }
  }, [depositWithdrawContract, publicClient]);

  const handleApprove = useCallback(
    async (requestIds: string[]) => {
      if (!requestIds || requestIds.length === 0) {
        notification.error("No requests selected for approval");
        return;
      }
      console.log("Prepare request IDs for approval:", requestIds);

      const selectedRequests = withdrawalRequests.filter(request => requestIds.includes(request._id));
      const contractRequestIds = selectedRequests.map(request => request.contractRequestId).filter(Boolean);

      if (contractRequestIds.length === 0) {
        notification.error("The selected request is missing the contract request ID");
        return;
      }

      setWithdrawalRequests(prevRequests =>
        prevRequests.map(request => (requestIds.includes(request._id) ? { ...request, isLoading: true } : request)),
      );

      try {
        notification.info("Processing...");
        const response = await fetch(`/api/admin?userAddress=${address}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contractRequestIds,
            type: "withdrawals",
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to process withdrawal request");
        }

        const result = await response.json();
        notification.success(result.message);
        await fetchWithdrawalRequests();
      } catch (error) {
        console.error("Failed to process withdrawal request:", error);
        notification.error(
          "Failed to process withdrawal request: " + (error instanceof Error ? error.message : String(error)),
        );
      } finally {
        setWithdrawalRequests(prevRequests =>
          prevRequests.map(request => (requestIds.includes(request._id) ? { ...request, isLoading: false } : request)),
        );
      }
    },
    [address, fetchWithdrawalRequests, withdrawalRequests],
  );

  const handleApproveClaims = useCallback(
    async (claimIds: string[]) => {
      if (!claimIds || claimIds.length === 0) {
        notification.error("No applications selected for approval");
        return;
      }

      const pendingClaims = claimRequests.filter(
        claim => claimIds.includes(claim._id) && claim.status.toLowerCase() === "pending",
      );

      if (pendingClaims.length === 0) {
        notification.error("Application has been processed");
        return;
      }

      const pendingClaimIds = pendingClaims.map(claim => claim._id);
      console.log("Pending applications:", pendingClaimIds);

      setClaimRequests(prevRequests =>
        prevRequests.map(request =>
          pendingClaimIds.includes(request._id) ? { ...request, isLoading: true } : request,
        ),
      );

      try {
        notification.info("Application is being processed...");
        const response = await fetch(`/api/admin?userAddress=${address}&type=claims`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ claimIds: pendingClaimIds }),
          signal: AbortSignal.timeout(30000),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to process collection application");
        }

        const result = await response.json();
        notification.success(result.message);
        await fetchClaimRequests();
      } catch (error) {
        console.error("An error occurred while processing the approval claim request:", error);
        notification.error(
          "Failed to process collection application: " + (error instanceof Error ? error.message : String(error)),
        );
      } finally {
        setClaimRequests(prevRequests =>
          prevRequests.map(request =>
            pendingClaimIds.includes(request._id) ? { ...request, isLoading: false } : request,
          ),
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

  useEffect(() => {
    if (address) {
      fetchWithdrawalRequests();
      fetchClaimRequests();
    }
  }, [address, fetchWithdrawalRequests, fetchClaimRequests]);

  if (!isConnected) {
    return <div className="container mx-auto p-4">Please connect the wallet first</div>;
  }

  if (address?.toLowerCase() !== ADMIN_ADDRESS.toLowerCase()) {
    return <div className="container mx-auto p-4">You do not have permission to access this page</div>;
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold my-4">Admin page</h1>
      <div className="flex space-x-4 mb-4">
        <button
          onClick={() => setActiveTab("withdrawals")}
          className={`py-2 px-4 rounded ${activeTab === "withdrawals" ? "bg-blue-500 text-white" : "bg-gray-300"}`}
        >
          Withdrawal request
        </button>
        <button
          onClick={() => setActiveTab("claims")}
          className={`py-2 px-4 rounded ${activeTab === "claims" ? "bg-blue-500 text-white" : "bg-primary"}`}
        >
          Task reward
        </button>
      </div>

      {activeTab === "withdrawals" ? (
        <div>
          {withdrawalRequests.length === 0 ? (
            <p className="text-lg text-gray-200">No withdrawal requests pending</p>
          ) : (
            <>
              <button
                onClick={checkContractState}
                className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded mb-4 mr-4"
              >
                Check the contract
              </button>
              <button
                onClick={handleBatchApprove}
                className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded mb-4"
                disabled={selectedRequests.length === 0}
              >
                Batch approval ({selectedRequests.length})
              </button>
              <table className="min-w-full bg-base-400 text-white">
                <thead>
                  <tr>
                    <th className="py-2 border-b text-center">Choose</th>
                    <th className="py-2 border-b text-center">ID</th>
                    <th className="py-2 border-b text-center">Address</th>
                    <th className="py-2 px-4 border-b text-center">Amount</th>
                    <th className="py-2 px-4 border-b text-center">Token</th>
                    <th className="py-2 px-4 border-b text-center">Date</th>
                    <th className="py-2 px-4 border-b text-center">State</th>
                    <th className="py-2 px-4 border-b text-center">Operate</th>
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
                          {request.status || "unknown"}
                        </span>
                      </td>
                      <td className="py-2 px-4 border-b text-center">
                        <button
                          onClick={() => handleApprove([request._id])}
                          className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
                          disabled={request.isLoading || request.status === "Approved"}
                        >
                          {request.isLoading ? "Processing..." : request.status === "Approved" ? "Approved" : "approve"}
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
            <p className="text-lg text-gray-200">There are no pending claims</p>
          ) : (
            <>
              <button
                onClick={handleBatchApprove}
                className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded mb-4"
                disabled={selectedRequests.length === 0}
              >
                Batch approval ({selectedRequests.length})
              </button>
              <table className="min-w-full bg-base-400 text-white">
                <thead>
                  <tr>
                    <th className="py-2 border-b text-center">Choose</th>
                    <th className="py-2 border-b text-center">ID</th>
                    <th className="py-2 border-b text-center">Address</th>
                    <th className="py-2 px-4 border-b text-center">Amount</th>
                    <th className="py-2 px-4 border-b text-center">Task ID</th>
                    <th className="py-2 px-4 border-b text-center">State</th>
                    <th className="py-2 px-4 border-b text-center">Operate</th>
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
                          {claim.status || "unknown"}
                        </span>
                      </td>
                      <td className="py-2 px-4 border-b text-center">
                        <button
                          onClick={() => handleApproveClaims([claim._id])}
                          className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
                          disabled={claim.isLoading || claim.status === "Approved"}
                        >
                          {claim.isLoading ? "Processing..." : claim.status === "Approved" ? "Approved" : "Approve"}
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
