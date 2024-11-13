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
          status: "published",
        },
      },
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ message: "Task or participant not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: "Task status reset successfully" });
  } catch (error) {
    console.error("Failed to reset task status:", error);
    return NextResponse.json({ success: false, message: "Failed to reset task status" }, { status: 500 });
  }
}
