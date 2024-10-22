import { NextResponse } from "next/server";
import clientPromise from "../../../lib/mongodb";

// 连接到你的MongoDB
// 连接到 MongoDB 并插入测试数据
export async function GET() {
  try {
    const client = await clientPromise;
    const db = client.db("taskcube");
    const collection = db.collection("testCollection");

    // 插入数据
    await collection.insertOne({ name: "测试数据", createdAt: new Date() });

    // 查询数据
    const data = await collection.find({}).toArray();

    return NextResponse.json({ message: "数据插入成功!", data });
  } catch (error: unknown) {
    console.error("操作失败:", error);
    const errorMessage = error instanceof Error ? error.message : "未知错误";
    return NextResponse.json({ message: "操作失败", error: errorMessage });
  }
}
