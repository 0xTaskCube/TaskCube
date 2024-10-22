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
    YourContract: {
      address: string;
      abi: ReadonlyArray<AbiItem>;
      inheritedFunctions: Record<string, never>;
    };
  };
};

const ADMIN_ADDRESS = process.env.ADMIN_ADDRESS || "0xB1CD9f3c65496ddD185F81d5E5b0BC9004535521";
const CONTRACT_ADDRESS =
  process.env.NEXT_PUBLIC_DEPOSIT_WITHDRAW_ADDRESS || "0x4Ce3c2A082f72AEC94Ea9027aEb8aA7856588A19";
const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY;

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

  console.log("API 路由被调用");
  console.log("请求的用户地址:", userAddress);

  if (!userAddress || userAddress.toLowerCase() !== ADMIN_ADDRESS.toLowerCase()) {
    console.log("权限检查失败");
    return NextResponse.json({ success: false, error: "没有管理员权限" }, { status: 403 });
  }

  try {
    const client = await clientPromise;
    const db = client.db("taskcube");
    const collection = db.collection<WithdrawalRequest>("transactions");

    console.log("查询的集合名称:", collection.collectionName);

    const withdrawRequests = await collection.find({ type: "withdraw" }).toArray();
    console.log("提现请求返回的记录:", withdrawRequests);

    const formattedRequests = withdrawRequests.map(request => ({
      ...request,
      _id: request._id.toString(),
      amount: request.amount.toString(),
    }));

    console.log("格式化后的提现请求:", formattedRequests);

    return NextResponse.json({ success: true, requests: formattedRequests });
  } catch (error: unknown) {
    console.error("获取提现请求失败:", error);
    let errorMessage = "获取提现请求失败";
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
    return NextResponse.json({ success: false, error: "没有管理员权限" }, { status: 403 });
  }

  try {
    const { userAddress, amount, type, contractRequestId } = await request.json();

    if (!userAddress || !amount || !type) {
      return NextResponse.json({ success: false, error: "缺少必要的字段" }, { status: 400 });
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
    console.error("交易记录失败:", error);
    return NextResponse.json({ success: false, error: "交易记录失败" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  console.log("PUT 方法被调用");
  const { searchParams } = new URL(request.url);
  const userAddress = searchParams.get("userAddress");

  console.log("用户地址:", userAddress);
  console.log("管理员地址:", ADMIN_ADDRESS);

  if (!userAddress || userAddress.toLowerCase() !== ADMIN_ADDRESS.toLowerCase()) {
    console.log("权限检查失败");
    return NextResponse.json({ success: false, error: "没有管理员权限" }, { status: 403 });
  }

  try {
    const body = await request.json();
    console.log("接收到的请求体:", body);
    if (!body || !body.contractRequestIds || !Array.isArray(body.contractRequestIds)) {
      console.error("无效的请求体格式");
      return NextResponse.json({ success: false, error: "无效的请求格式" }, { status: 400 });
    }

    const { contractRequestIds } = body;
    console.log("接收到的合约请求 ID:", contractRequestIds);

    if (contractRequestIds.length === 0) {
      console.error("合约请求 ID 列表为空");
      return NextResponse.json({ success: false, error: "没有提供要处理的合约请求 ID" }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db("taskcube");
    const collection = db.collection<WithdrawalRequest>("transactions");
    // 获取所有请求的详细信息
    const requests = await collection.find({ contractRequestId: { $in: contractRequestIds } }).toArray();
    console.log("从数据库获取的请求:", requests);
    if (requests.length === 0) {
      console.error("未找到匹配的请求");
      return NextResponse.json({ success: false, error: "未找到匹配的请求" }, { status: 404 });
    }
    // 更新数据 库中的请求状态
    const updateResult = await collection.updateMany(
      { contractRequestId: { $in: contractRequestIds } },
      { $set: { status: "approved" } },
    );
    console.log("数据库更新结果:", updateResult);

    const targetNetworks = getTargetNetworks();
    if (targetNetworks.length === 0) {
      throw new Error("没有找到目标网络");
    }
    const targetNetwork = targetNetworks[0];

    const typedDeployedContracts = deployedContracts as unknown as DeployedContracts;

    if (targetNetwork.id !== 11155111) {
      throw new Error("不支持的网络");
    }

    const contractConfig = typedDeployedContracts[11155111].DepositWithdraw;

    if (!contractConfig) {
      throw new Error("合约配置未找到");
    }

    const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
    console.log("RPC URL:", process.env.RPC_URL);

    const privateKey = process.env.DEPLOYER_PRIVATE_KEY;
    if (!privateKey) {
      console.error("部署者私钥未设置");
      return NextResponse.json({ success: false, error: "部署者私钥未设置" }, { status: 500 });
    }
    const wallet = new ethers.Wallet(privateKey, provider);

    const contract = new ethers.Contract(CONTRACT_ADDRESS, contractConfig.abi, wallet);
    console.log("Contract address:", CONTRACT_ADDRESS);

    let executedCount = 0;
    for (const request of requests) {
      try {
        console.log(`开始处理请求 ID: ${request._id}`);
        if (!request.contractRequestId) {
          console.error(`请求 ${request._id} 缺少 contractRequestId`);
          continue;
        }

        console.log(`准备调用合约方法 executeWithdrawal`);
        console.log(`合约请求 ID: ${request.contractRequestId}`);

        const tx = await contract.executeWithdrawal(request.contractRequestId);
        console.log(`交易已发送，哈希:`, tx.hash);
        const receipt = await tx.wait();
        console.log(`交易收据:`, receipt);

        executedCount++;

        console.log(`更新数据库状态为 "executed"`);
        await collection.updateOne({ _id: request._id }, { $set: { status: "executed" } });
      } catch (error) {
        console.error(`执行提现请求 ${request._id} 失败:`, error);
        // 打印更详细的错误信息
        if (error instanceof Error) {
          console.error(`错误类型: ${error.name}`);
          console.error(`错误消息: ${error.message}`);
          console.error(`错误堆栈: ${error.stack}`);
        }
        console.log(`将状态改回 "pending"`);
        await collection.updateOne({ _id: request._id }, { $set: { status: "pending" } });
      }
    }
    console.log(`执行完成，成功执行 ${executedCount} 个请求`);
    return NextResponse.json({
      success: true,
      message: `${updateResult.modifiedCount} 个提现请求已批准，${executedCount} 个已执行`,
    });
  } catch (error) {
    console.error("批准提现请求失败:", error);
    if (error instanceof Error) {
      console.error(`错误类型: ${error.name}`);
      console.error(`错误消息: ${error.message}`);
      console.error(`错误堆栈: ${error.stack}`);
    }
    let errorMessage = "批准提现请求失败";
    if (error instanceof Error) {
      errorMessage += ": " + error.message;
    }
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}
