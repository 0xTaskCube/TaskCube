import { NextRequest, NextResponse } from "next/server";
import clientPromise from "../../../../lib/mongodb";
import { Document } from "mongodb";

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
  const taskId = searchParams.get("taskId");

  if (!address) {
    return NextResponse.json({ success: false, message: "Address is required" }, { status: 400 });
  }

  try {
    const client = await clientPromise;
    const db = client.db("taskcube");

    // 1. 获取奖励分配记录
    const distributions = await db
      .collection<RewardDistribution>("rewardDistributions")
      .find({
        $or: [{ participantAddress: address }, { directInviterAddress: address }, { indirectInviterAddress: address }],
      })
      .toArray();

    // 2. 获取已领取的记录
    const claims = await db.collection("claims").find({ userAddress: address }).toArray();

    const totalClaimedAmount = claims.reduce((sum, claim) => sum + Number(claim.amount), 0);

    // 3. 计算各类奖励
    let totalAvailableReward = 0;
    const taskBalances = new Map<string, number>();

    distributions.forEach(dist => {
      // 计算该用户在每个任务中的总奖励
      let taskReward = 0;

      // 完成任务的奖励
      if (dist.participantAddress === address) {
        taskReward += dist.userReward;
        // 记录任务奖励
        const currentTaskBalance = taskBalances.get(dist.taskId.toString()) || 0;
        taskBalances.set(dist.taskId.toString(), currentTaskBalance + dist.userReward);
      }

      // 直接邀请奖励
      if (dist.directInviterAddress === address) {
        taskReward += dist.directInviterReward;
        // 记录邀请奖励到 taskId = 0
        const currentInviteBalance = taskBalances.get("0") || 0;
        taskBalances.set("0", currentInviteBalance + dist.directInviterReward);
      }

      // 间接邀请奖励
      if (dist.indirectInviterAddress === address) {
        taskReward += dist.indirectInviterReward;
        // 记录邀请奖励到 taskId = 0
        const currentInviteBalance = taskBalances.get("0") || 0;
        taskBalances.set("0", currentInviteBalance + dist.indirectInviterReward);
      }

      totalAvailableReward += taskReward;
    });

    // 4. 计算最终可用余额
    const availableBounty = Math.max(0, totalAvailableReward - totalClaimedAmount);

    console.log("奖励计算结果:", {
      address,
      totalAvailableReward,
      totalClaimedAmount,
      availableBounty,
      taskBalances: Object.fromEntries(taskBalances),
    });

    // 如果请求特定任务的余额
    if (taskId) {
      const taskBalance = taskBalances.get(taskId) || 0;
      return NextResponse.json({
        success: true,
        balance: Number(taskBalance).toFixed(2),
        taskId,
      });
    }

    return NextResponse.json({
      success: true,
      bounty: Number(availableBounty).toFixed(2),
      details: {
        totalAvailableReward: totalAvailableReward.toFixed(2),
        claimedAmount: totalClaimedAmount.toFixed(2),
        taskBalances: Object.fromEntries(taskBalances),
        distributions: distributions,
      },
    });
  } catch (error) {
    console.error("获取奖励失败:", error);
    return NextResponse.json(
      {
        success: false,
        message: "获取奖励失败",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
