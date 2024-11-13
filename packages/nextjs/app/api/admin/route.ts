import { NextResponse } from "next/server";
import { ethers } from "ethers";
import { ObjectId } from "mongodb";
import deployedContracts from "~~/contracts/deployedContracts";
import clientPromise from "~~/lib/mongodb";
import { getTargetNetworks } from "~~/utils/scaffold-eth";

type AbiItem = {
  inputs?: ReadonlyArray<{
    internalType: string;
    name: string;
    type: string;
  }>;
  stateMutability?: string;
  type: string;
  name?: string;
  outputs?: ReadonlyArray<{
    internalType: string;
    name: string;
    type: string;
  }>;
  anonymous?: boolean;
};

type DeployedContracts = {
  11155111: {
    DepositWithdraw: {
      address: string;
      abi: ReadonlyArray<AbiItem>;
      inheritedFunctions: Record<string, never>;
    };
  };
};

const ADMIN_ADDRESS = process.env.ADMIN_ADDRESS || "0xB1CD9f3c65496ddD185F81d5E5b0BC9004535521";
// const CONTRACT_ADDRESS =
//   process.env.NEXT_PUBLIC_DEPOSIT_WITHDRAW_ADDRESS || "0x4Ce3c2A082f72AEC94Ea9027aEb8aA7856588A19";

interface WithdrawalRequest {
  _id: ObjectId | string;
  userAddress: string;
  amount: string;
  type: string;
  date: string;
  status: string;
  contractRequestId?: string;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userAddress = searchParams.get("userAddress");

  if (!userAddress || userAddress.toLowerCase() !== ADMIN_ADDRESS.toLowerCase()) {
    return NextResponse.json({ success: false, error: "No administrator rights" }, { status: 403 });
  }

  try {
    const client = await clientPromise;
    const db = client.db("taskcube");

    const collection = db.collection<WithdrawalRequest>("transactions");

    const withdrawRequests = await collection.find({ type: "withdraw" }).toArray();
    console.log("Records returned by withdrawal request:", withdrawRequests);

    const formattedRequests = withdrawRequests.map(request => ({
      ...request,
      _id: request._id.toString(),
      amount: request.amount.toString(),
    }));

    console.log("Formatted withdrawal request:", formattedRequests);
    return NextResponse.json({
      success: true,
      requests: formattedRequests,
      total: formattedRequests.length,
      pendingCount: formattedRequests.filter(r => r.status === "pending").length,
      executedCount: formattedRequests.filter(r => r.status === "executed").length,
    });
  } catch (error) {
    console.error("Failed to obtain withdrawal request:", error);
    let errorMessage = "Failed to obtain withdrawal request";
    if (error instanceof Error) {
      errorMessage += ": " + error.message;
    }
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const userAddress = searchParams.get("userAddress");

  if (!userAddress || userAddress.toLowerCase() !== ADMIN_ADDRESS.toLowerCase()) {
    return NextResponse.json({ success: false, error: "No administrator rights" }, { status: 403 });
  }

  try {
    const { userAddress, amount, type, contractRequestId } = await request.json();

    if (!userAddress || !amount || !type) {
      return NextResponse.json({ success: false, error: "Required fields are missing" }, { status: 400 });
    }
    const client = await clientPromise;
    const db = client.db("taskcube");
    const collection = db.collection("transactions");

    const transaction = {
      userAddress,
      amount,
      type,
      date: new Date(),
      status: type === "withdraw" ? "pending" : "completed",
      contractRequestId: type === "withdraw" ? contractRequestId : null,
    };

    const result = await collection.insertOne(transaction);

    return NextResponse.json({
      success: true,
      transaction: { ...transaction, _id: result.insertedId.toString() },
    });
  } catch (error) {
    console.error("Transaction record failed:", error);
    return NextResponse.json({ success: false, error: "Transaction record failed" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const { searchParams } = new URL(request.url);
  const userAddress = searchParams.get("userAddress");

  if (!userAddress || userAddress.toLowerCase() !== ADMIN_ADDRESS.toLowerCase()) {
    console.log("Permission check failed");
    return NextResponse.json({ success: false, error: "No administrator rights" }, { status: 403 });
  }

  try {
    let body;
    try {
      body = await request.json();
      console.log("Successfully parsed request body:", body);
    } catch (error) {
      console.error("Failed to parse request body:", error);
      return NextResponse.json({ success: false, error: "Invalid request body format" }, { status: 400 });
    }

    if (!body || !body.contractRequestIds || !Array.isArray(body.contractRequestIds)) {
      return NextResponse.json({ success: false, error: "Invalid request format" }, { status: 400 });
    }

    const { contractRequestIds } = body;

    if (contractRequestIds.length === 0) {
      return NextResponse.json(
        { success: false, error: "No contract request provided to process ID" },
        { status: 400 },
      );
    }

    const client = await clientPromise;
    const db = client.db("taskcube");
    const collection = db.collection<WithdrawalRequest>("transactions");

    const requests = await collection.find({ contractRequestId: { $in: contractRequestIds } }).toArray();

    if (requests.length === 0) {
      return NextResponse.json({ success: false, error: "No matching request found" }, { status: 404 });
    }

    const updateResult = await collection.updateMany(
      { contractRequestId: { $in: contractRequestIds } },
      { $set: { status: "approved" } },
    );

    const targetNetworks = getTargetNetworks();
    if (targetNetworks.length === 0) {
      throw new Error("Target network not found");
    }
    const targetNetwork = targetNetworks[0];

    const typedDeployedContracts = deployedContracts as unknown as DeployedContracts;

    if (targetNetwork.id !== 11155111) {
      throw new Error("Unsupported network");
    }

    const contractConfig = typedDeployedContracts[11155111].DepositWithdraw;

    if (!contractConfig) {
      throw new Error("Contract configuration not found");
    }

    const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
    const privateKey = process.env.DEPLOYER_PRIVATE_KEY;
    if (!privateKey) {
      console.error("Private key not set");
      return NextResponse.json({ success: false, error: "Private key not set" }, { status: 500 });
    }

    const wallet = new ethers.Wallet(privateKey, provider);
    const contract = new ethers.Contract(contractConfig.address, contractConfig.abi, wallet);

    let executedCount = 0;

    for (const request of requests) {
      try {
        if (!request.contractRequestId) {
          console.error(`request ${request._id} lack contractRequestId`);
          continue;
        }

        const tx = await contract.executeWithdrawal(request.contractRequestId);

        const receipt = await tx.wait();

        executedCount++;

        await collection.updateOne({ _id: request._id }, { $set: { status: "executed" } });
      } catch (error) {
        console.error(`Execute withdrawal request ${request._id} fail:`, error);
        if (error instanceof Error) {
          console.error(`error type: ${error.name}`);
          console.error(`error message: ${error.message}`);
          console.error(`error stack: ${error.stack}`);
        }

        await collection.updateOne({ _id: request._id }, { $set: { status: "pending" } });
      }
    }

    return NextResponse.json({
      success: true,
      message: `${updateResult.modifiedCount} Withdrawal request has been approved,${executedCount} executed`,
    });
  } catch (error) {
    console.error("Request processing failed:", error);
    if (error instanceof Error) {
      console.error(`error.name: ${error.name}`);
      console.error(`error.message: ${error.message}`);
      console.error(`error.stack: ${error.stack}`);
    }
    let errorMessage = "Request processing failed";
    if (error instanceof Error) {
      errorMessage += ": " + error.message;
    }
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}
