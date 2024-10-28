import { NextRequest, NextResponse } from "next/server";
import clientPromise from "../../../../lib/mongodb";
import { Document, WithId } from "mongodb";

interface RewardDistribution extends Document {
  taskId: string;
  participantAddress: string;
  directInviterAddress: string | null;
  indirectInviterAddress: string | null;
  userReward: number;
  directInviterReward: number;
  indirectInviterReward: number;
  unclaimedReward: number;
  platformFee: number;
  distributedAt: Date;
}

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

    // 1. 获取用户当前的 bounty 总额
    const user = await db.collection("users").findOne({ address });
    const currentBounty = user?.bounty || 0;

    // 2. 获取奖励分配明细
    const distributions = await db
      .collection<RewardDistribution>("rewardDistributions")
      .find({
        $or: [{ participantAddress: address }, { directInviterAddress: address }, { indirectInviterAddress: address }],
      })
      .toArray();

    // 3. 计算各类奖励总额
    let taskCompletionRewards = 0;
    let directInviterRewards = 0;
    let indirectInviterRewards = 0;

    distributions.forEach(distribution => {
      if (distribution.participantAddress === address) {
        taskCompletionRewards += distribution.userReward;
      }
      if (distribution.directInviterAddress === address) {
        directInviterRewards += distribution.directInviterReward;
      }
      if (distribution.indirectInviterAddress === address) {
        indirectInviterRewards += distribution.indirectInviterReward;
      }
    });

    const totalBounty = taskCompletionRewards + directInviterRewards + indirectInviterRewards;

    console.log(`用户 ${address} 的奖励明细:`, {
      总额: totalBounty,
      任务完成奖励: taskCompletionRewards,
      直接邀请奖励: directInviterRewards,
      间接邀请奖励: indirectInviterRewards,
    });

    return NextResponse.json({
      success: true,
      bounty: totalBounty.toFixed(2),
      details: {
        taskCompletionRewards: taskCompletionRewards.toFixed(2),
        directInviterRewards: directInviterRewards.toFixed(2),
        indirectInviterRewards: indirectInviterRewards.toFixed(2),
        distributions: distributions, // 添加完整的分配记录
      },
    });
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
