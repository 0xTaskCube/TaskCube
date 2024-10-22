import { NextRequest, NextResponse } from "next/server";
import clientPromise from "../../../../lib/mongodb";
import { ObjectId } from "mongodb";

export async function POST(request: NextRequest) {
  const { taskId, participantAddress } = await request.json();

  if (!taskId || !participantAddress) {
    return NextResponse.json({ message: "TaskId and participantAddress are required" }, { status: 400 });
  }

  try {
    const client = await clientPromise;
    const db = client.db("taskcube");

    const result = await db.collection("tasks").updateOne(
      { _id: new ObjectId(taskId as string), "participants.address": participantAddress },
      {
        $set: {
          "participants.$.status": "accepted",
          status: "published", // 重置任务整体状态
        },
      },
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ message: "Task or participant not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: "Task status reset successfully" });
  } catch (error) {
    console.error("重置任务状态失败:", error);
    return NextResponse.json({ success: false, message: "重置任务状态失败" }, { status: 500 });
  }
}
