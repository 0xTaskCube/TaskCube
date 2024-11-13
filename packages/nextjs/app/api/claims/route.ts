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

    if (!userAddress || !amount || !bountyId || !contractRequestId || !taskId) {
      return NextResponse.json(
        {
          success: false,
          message: "Missing required field",
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

    const result = await db.collection("claims").insertOne({
      userAddress,
      amount,
      bountyId,
      taskId,
      contractRequestId,
      status: status || "executed",
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
      throw new Error("Failed to save record");
    }

    return NextResponse.json({
      success: true,
      message: "Collection record has been saved",
      data: {
        id: result.insertedId,
      },
    });
  } catch (error) {
    console.error("Failed to save collection record:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Failed to save collection record",
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

    const query: any = {};
    if (userAddress) query.userAddress = userAddress;
    if (status) query.status = status;

    const claims = await db.collection("claims").find(query).sort({ createdAt: -1 }).toArray();

    return NextResponse.json({
      success: true,
      data: claims,
    });
  } catch (error) {
    console.error("Failed to obtain collection record:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Failed to obtain collection record",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
