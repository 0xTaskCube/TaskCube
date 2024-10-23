import { NextRequest, NextResponse } from "next/server";
import clientPromise from "../../../../lib/mongodb";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get("address");

  if (!address) {
    console.log("获取 Bounty 失败: 缺少地址参数");
    return NextResponse.json({ success: false, message: "Address is required" }, { status: 400 });
  }

  try {
    const client = await clientPromise;
    const db = client.db("taskcube");

    const user = await db.collection("users").findOne({ address });

    console.log(`获取用户 ${address} 的 Bounty:`, user?.bounty);

    if (user && typeof user.bounty === "number") {
      return NextResponse.json({ success: true, bounty: user.bounty });
    } else {
      console.log(`用户 ${address} 不存在或 Bounty 未定义，返回 0`);
      return NextResponse.json({ success: true, bounty: 0 });
    }
  } catch (error) {
    console.error("获取 Bounty 失败:", error);
    return NextResponse.json(
      {
        success: false,
        message: "获取 Bounty 失败",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
