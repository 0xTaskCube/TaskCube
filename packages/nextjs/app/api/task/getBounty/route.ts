import { NextRequest, NextResponse } from "next/server";
import clientPromise from "../../../../lib/mongodb";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get("address");

  if (!address) {
    return NextResponse.json({ success: false, message: "Address is required" }, { status: 400 });
  }

  try {
    const client = await clientPromise;
    const db = client.db("taskcube");

    const user = await db.collection("users").findOne({ address });

    if (user && user.bounty !== undefined) {
      return NextResponse.json({ success: true, bounty: user.bounty });
    } else {
      return NextResponse.json({ success: true, bounty: 0 });
    }
  } catch (error) {
    console.error("获取 Bounty 失败:", error);
    return NextResponse.json({ success: false, message: "获取 Bounty 失败" }, { status: 500 });
  }
}
