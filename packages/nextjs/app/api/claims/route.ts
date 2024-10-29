import { NextRequest, NextResponse } from "next/server";
import clientPromise from "~~/lib/mongodb";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userAddress, amount, bountyId, contractRequestId, taskId, status } = body;

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
      contractRequestId,
      taskId,
      status: status || "pending",
      createdAt: new Date(),
      updatedAt: new Date(),
      transactionHash: null, // 用于后续记录执行交易的哈希
      approvedBy: null, // 用于记录审批人
      approvedAt: null, // 用于记录审批时间
      executedAt: null, // 用于记录执行时间
      remarks: null, // 用于记录备注信息
    });

    return NextResponse.json({
      success: true,
      message: "领取申请已提交",
      data: {
        id: result.insertedId,
        userAddress,
        amount,
        bountyId,
        contractRequestId,
        taskId,
        status: "pending",
        createdAt: new Date(),
      },
    });
  } catch (error) {
    console.error("处理领取申请失败:", error);
    return NextResponse.json(
      {
        success: false,
        message: "处理领取申请失败",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

export async function GET() {
  try {
    const client = await clientPromise;
    const db = client.db("taskcube");

    const claims = await db.collection("claims").find({}).sort({ createdAt: -1 }).toArray();

    return NextResponse.json({
      success: true,
      data: claims,
    });
  } catch (error) {
    console.error("获取领取申请列表失败:", error);
    return NextResponse.json(
      {
        success: false,
        message: "获取领取申请列表失败",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
