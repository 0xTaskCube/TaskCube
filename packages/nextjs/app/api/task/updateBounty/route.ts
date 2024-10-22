import { NextRequest, NextResponse } from "next/server";
import clientPromise from "~~/lib/mongodb";

export async function POST(request: NextRequest) {
  const { address, reward } = await request.json();

  if (!address || !reward) {
    return NextResponse.json({ message: "Address and reward are required" }, { status: 400 });
  }

  try {
    const client = await clientPromise;
    const db = client.db("taskcube");

    const result = await db
      .collection("users")
      .updateOne({ address }, { $inc: { bounty: parseFloat(reward) } }, { upsert: true });

    console.log("更新 Bounty 结果:", result);

    return NextResponse.json({ success: true, message: "Bounty updated successfully" });
  } catch (error) {
    console.error("更新 Bounty 失败:", error);
    return NextResponse.json({ success: false, message: "更新 Bounty 失败" }, { status: 500 });
  }
}
