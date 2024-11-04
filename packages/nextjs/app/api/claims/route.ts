import { NextRequest, NextResponse } from "next/server";
import clientPromise from "~~/lib/mongodb";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      userAddress,
      amount,
      bountyId,
      contractRequestId,
      taskId,
      status,
      transactionHash,
      executeTransactionHash,
      type,
      relatedTasks,
    } = body;

    // 验证必需字段
    if (!userAddress || !amount || !bountyId || !contractRequestId || !taskId) {
      return NextResponse.json(
        {
          success: false,
          message: "缺少必需字段",
          details: {
            userAddress: !userAddress,
            amount: !amount,
            bountyId: !bountyId,
            contractRequestId: !contractRequestId,
            taskId: !taskId,
          },
        },
        { status: 400 },
      );
    }

    const client = await clientPromise;
    const db = client.db("taskcube");

    // 创建新的领取记录
    const result = await db.collection("claims").insertOne({
      userAddress,
      amount,
      bountyId,
      taskId,
      contractRequestId,
      status: status || "executed", // 默认为 executed
      transactionHash,
      executeTransactionHash,
      type: type || "task",
      relatedTasks: relatedTasks || [
        {
          taskId,
          amount,
          type: type || "task",
        },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    if (!result.acknowledged) {
      throw new Error("保存记录失败");
    }

    return NextResponse.json({
      success: true,
      message: "领取记录已保存",
      data: {
        id: result.insertedId,
      },
    });
  } catch (error) {
    console.error("保存领取记录失败:", error);
    return NextResponse.json(
      {
        success: false,
        message: "保存领取记录失败",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userAddress = searchParams.get("userAddress");
    const status = searchParams.get("status");

    const client = await clientPromise;
    const db = client.db("taskcube");

    // 构建查询条件
    const query: any = {};
    if (userAddress) query.userAddress = userAddress;
    if (status) query.status = status;

    console.log("Claims 查询条件:", query);

    const claims = await db.collection("claims").find(query).sort({ createdAt: -1 }).toArray();

    console.log(`找到 ${claims.length} 条记录`);

    return NextResponse.json({
      success: true,
      data: claims,
    });
  } catch (error) {
    console.error("获取领取记录失败:", error);
    return NextResponse.json(
      {
        success: false,
        message: "获取领取记录失败",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
