import { NextRequest, NextResponse } from "next/server";
import clientPromise from "../../../lib/mongodb";

// 保存邀请数据的 POST 方法
export async function POST(request: NextRequest) {
  const { inviter, invitee } = await request.json();

  try {
    const client = await clientPromise;
    const db = client.db("taskcube");

    // 检查当前用户钱包 invitee 是否已经被任何人邀请过
    const existingInvite = await db.collection("invites").findOne({ invitee });
    if (existingInvite) {
      return NextResponse.json({ message: "This wallet address has already been invited", status: "error" });
    }

    // 如果 invitee 没有被邀请过，则插入新数据
    const result = await db.collection("invites").insertOne({
      inviter,
      invitee,
      createdAt: new Date(),
    });

    return NextResponse.json({ message: "邀请数据保存成功", result, status: "success" });
  } catch (error) {
    return NextResponse.json({ message: "保存邀请数据失败", error: (error as Error).message });
  }
}

// 获取邀请数据的 GET 方法
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const inviter = searchParams.get("inviter");
  const invitee = searchParams.get("invitee");

  try {
    const client = await clientPromise;
    const db = client.db("taskcube");

    // 检查是否传入 invitee 参数，如果传入则检查 invitee 是否已经被邀请过
    if (invitee) {
      const existingInvite = await db.collection("invites").findOne({ invitee });
      if (existingInvite) {
        return NextResponse.json({
          message: "This wallet address has already been invited",
          status: "invited",
          inviter: existingInvite.inviter,
        });
      }
      return NextResponse.json({ message: "This wallet address has not been invited", status: "not_invited" });
    }

    // 如果没有 invitee 参数，则执行原来的获取直接邀请者的逻辑
    if (inviter) {
      const invites = await db.collection("invites").find({ inviter }).toArray();

      // 递归获取子邀请者，限制深度为2
      const fetchNestedInvites = async (invitee: string, depth: number): Promise<any[]> => {
        if (depth >= 2) return [];

        const nestedInvites = await db.collection("invites").find({ inviter: invitee }).toArray();
        return Promise.all(
          nestedInvites.map(async nestedInvite => ({
            invitee: nestedInvite.invitee,
            children: await fetchNestedInvites(nestedInvite.invitee, depth + 1),
          })),
        );
      };

      const result = await Promise.all(
        invites.map(async invite => ({
          invitee: invite.invitee,
          children: await fetchNestedInvites(invite.invitee, 1),
        })),
      );

      return NextResponse.json({ inviter, invites: result });
    }

    // 如果没有任何参数，返回错误
    return NextResponse.json({ message: "Missing required parameters", status: "error" });
  } catch (error) {
    return NextResponse.json({ message: "Failed to fetch invites", error: (error as Error).message });
  }
}
