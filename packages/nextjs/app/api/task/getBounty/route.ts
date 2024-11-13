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

    const distributions = await db
      .collection<RewardDistribution>("rewardDistributions")
      .find({
        $or: [{ participantAddress: address }, { directInviterAddress: address }, { indirectInviterAddress: address }],
      })
      .toArray();

    const claims = await db.collection("claims").find({ userAddress: address }).toArray();

    const totalClaimedAmount = claims.reduce((sum, claim) => sum + Number(claim.amount), 0);

    let totalAvailableReward = 0;
    const taskBalances = new Map<string, number>();

    distributions.forEach(dist => {
      let taskReward = 0;

      if (dist.participantAddress === address) {
        taskReward += dist.userReward;

        const currentTaskBalance = taskBalances.get(dist.taskId.toString()) || 0;
        taskBalances.set(dist.taskId.toString(), currentTaskBalance + dist.userReward);
      }

      if (dist.directInviterAddress === address) {
        taskReward += dist.directInviterReward;

        const currentInviteBalance = taskBalances.get("0") || 0;
        taskBalances.set("0", currentInviteBalance + dist.directInviterReward);
      }

      if (dist.indirectInviterAddress === address) {
        taskReward += dist.indirectInviterReward;

        const currentInviteBalance = taskBalances.get("0") || 0;
        taskBalances.set("0", currentInviteBalance + dist.indirectInviterReward);
      }

      totalAvailableReward += taskReward;
    });

    const availableBounty = Math.max(0, totalAvailableReward - totalClaimedAmount);

    console.log("Reward calculation results:", {
      address,
      totalAvailableReward,
      totalClaimedAmount,
      availableBounty,
      taskBalances: Object.fromEntries(taskBalances),
    });

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
    console.error("Failed to obtain rewards:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Failed to obtain rewards",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
