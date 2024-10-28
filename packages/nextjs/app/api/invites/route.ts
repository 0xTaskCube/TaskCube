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

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const inviter = searchParams.get("inviter");
  const invitee = searchParams.get("invitee");

  try {
    const client = await clientPromise;
    const db = client.db("taskcube");

    if (invitee) {
      const invite = await db.collection("invites").findOne({ invitee });
      if (invite) {
        return NextResponse.json({ status: "invited", inviter: invite.inviter });
      } else {
        return NextResponse.json({ status: "not_invited" });
      }
    }

    if (inviter) {
      const invites = await db.collection("invites").find({ inviter }).toArray();

      const result = await Promise.all(
        invites.map(async invite => {
          // 获取一级被邀请用户的所有存款交易
          const deposits = await db
            .collection("transactions")
            .find({
              userAddress: invite.invitee,
              type: "deposit",
              status: "completed",
            })
            .toArray();

          // 计算一级被邀请用户的总存款金额
          const totalDeposits = deposits.reduce((sum, deposit) => sum + parseFloat(deposit.amount), 0);

          // 获取二级邀请
          const secondLevelInvites = await db.collection("invites").find({ inviter: invite.invitee }).toArray();

          const children = await Promise.all(
            secondLevelInvites.map(async secondInvite => {
              // 获取二级被邀请用户的所有存款交易
              const secondDeposits = await db
                .collection("transactions")
                .find({
                  userAddress: secondInvite.invitee,
                  type: "deposit",
                  status: "completed",
                })
                .toArray();

              // 计算二级被邀请用户的总存款金额
              const secondTotalDeposits = secondDeposits.reduce((sum, deposit) => sum + parseFloat(deposit.amount), 0);

              return {
                invitee: secondInvite.invitee,
                balance: secondTotalDeposits.toFixed(2), // 使用两位小数
              };
            }),
          );

          return {
            invitee: invite.invitee,
            balance: totalDeposits.toFixed(2), // 使用两位小数
            children: children,
          };
        }),
      );

      return NextResponse.json({ inviter, invites: result });
    }

    return NextResponse.json({ message: "Missing required parameters", status: "error" });
  } catch (error) {
    return NextResponse.json({ message: "Failed to fetch invites", error: (error as Error).message });
  }
}
