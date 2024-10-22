// packages/nextjs/app/api/DepositWithdrawal/route.ts
import { NextResponse } from "next/server";
import clientPromise from "../../../lib/mongodb";
import { ObjectId } from "mongodb";

interface WithdrawalRequest {
  _id?: ObjectId;
  userAddress: string;
  amount: string;
  type: string;
  date: Date;
  status: string;
  contractRequestId?: string;
}

export async function POST(request: Request) {
  try {
    const { userAddress, amount, type, contractRequestId } = await request.json();

    if (!userAddress || !amount || !type) {
      return NextResponse.json({ success: false, error: "缺少必要的字段" }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db("taskcube");
    const collection = db.collection<WithdrawalRequest>("transactions");

    const transaction: Omit<WithdrawalRequest, "_id"> = {
      userAddress,
      amount,
      type,
      date: new Date(),
      status: type === "withdraw" ? "pending" : "completed",
      contractRequestId: type === "withdraw" ? contractRequestId : undefined,
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

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userAddress = searchParams.get("userAddress");
  const action = searchParams.get("action");

  if (!userAddress) {
    return NextResponse.json({ success: false, error: "缺少用户地址" }, { status: 400 });
  }

  try {
    const client = await clientPromise;
    const db = client.db("taskcube");
    const collection = db.collection("transactions");

    if (action === "getTransactions") {
      // 获取交易记录
      const transactions = await collection.find({ userAddress }).sort({ date: -1 }).limit(50).toArray();

      return NextResponse.json({
        success: true,
        transactions: transactions.map(t => ({
          type: t.type,
          amount: t.amount,
          date: t.date.toISOString().split("T")[0],
          status: t.status,
        })),
      });
    } else if (action === "getBalance") {
      // 获取所有存款
      const deposits = await collection
        .find({
          userAddress,
          type: "deposit",
          status: "completed",
        })
        .toArray();

      // 获取待处理的提现
      const pendingWithdrawals = await collection
        .find({
          userAddress,
          type: "withdraw",
          status: "pending",
        })
        .toArray();

      // 获取已执行的提现
      const executedWithdrawals = await collection
        .find({
          userAddress,
          type: "withdraw",
          status: "executed",
        })
        .toArray();

      const totalDeposits = deposits.reduce((sum, d) => sum + parseFloat(d.amount), 0);
      const pendingTotal = pendingWithdrawals.reduce((sum, w) => sum + parseFloat(w.amount), 0);
      const executedTotal = executedWithdrawals.reduce((sum, w) => sum + parseFloat(w.amount), 0);

      const platformBalance = totalDeposits - executedTotal;
      const availableBalance = platformBalance - pendingTotal;

      return NextResponse.json({
        success: true,
        totalDeposits: totalDeposits.toFixed(6),
        pendingWithdrawalsTotal: pendingTotal.toFixed(6),
        executedWithdrawalsTotal: executedTotal.toFixed(6),
        platformBalance: platformBalance.toFixed(6),
        availableBalance: availableBalance.toFixed(6),
      });
    } else {
      return NextResponse.json({ success: false, error: "无效的操作" }, { status: 400 });
    }
  } catch (error) {
    console.error("操作失败:", error);
    return NextResponse.json({ success: false, error: "操作失败" }, { status: 500 });
  }
}
