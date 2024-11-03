import { NextRequest, NextResponse } from "next/server";
import clientPromise from "../../../lib/mongodb";
import { ObjectId } from "mongodb";

export async function POST(request: NextRequest) {
  const body = await request.json();
  console.log("收到 POST 请求:", body);

  // 检查是创建新任务还是提交任务
  if (body.title) {
    // 创建新任务
    const {
      title,
      description,
      startDate,
      endDate,
      reward,
      taskType,
      participationType,
      creatorAddress,
      taskCount,
      onChainTaskId,
    } = body;

    if (
      !title ||
      !description ||
      !startDate ||
      !endDate ||
      !reward ||
      !taskType ||
      !participationType ||
      !creatorAddress ||
      !taskCount
    ) {
      return NextResponse.json({ message: "所有字段都是必需的" }, { status: 400 });
    }

    try {
      const client = await clientPromise;
      const db = client.db("taskcube");

      const newTask = {
        title,
        description,
        startDate,
        endDate,
        reward,
        taskType,
        participationType,
        creatorAddress,
        taskCount,
        onChainTaskId,
        participants: [],
        status: "published",
        createdAt: new Date(),
      };

      const result = await db.collection("tasks").insertOne(newTask);

      if (result.insertedId) {
        console.log("任务发布成功:", result.insertedId);
        return NextResponse.json({ message: "任务发布成功", taskId: result.insertedId, status: "success" });
      } else {
        throw new Error("Failed to insert task");
      }
    } catch (error) {
      console.error("发布任务时出错:", error);
      return NextResponse.json({ message: "发布任务失败", error: (error as Error).message }, { status: 500 });
    }
  } else {
    // 提交任务
    const { taskId, address } = body;

    if (!taskId || !address) {
      return NextResponse.json({ message: "taskId 和 address 是必需的" }, { status: 400 });
    }

    try {
      const client = await clientPromise;
      const db = client.db("taskcube");

      // 首先检查任务是否存在
      const task = await db.collection("tasks").findOne({ _id: new ObjectId(taskId as string) });

      if (!task) {
        console.log("任务不存在:", taskId);
        return NextResponse.json({ message: "任务不存在" }, { status: 400 });
      }

      // 检查用户是否参与了该任务
      const participantIndex = task.participants.findIndex((p: any) => p.address === address);

      if (participantIndex === -1) {
        console.log("用户未参与该任务:", { taskId, address });
        return NextResponse.json({ message: "用户未参与该任务" }, { status: 400 });
      }

      // 检查任务是否已经提交
      if (task.participants[participantIndex].status === "submitted") {
        console.log("任务已经提交过了:", { taskId, address });
        return NextResponse.json({ message: "任务已经提交过了" }, { status: 400 });
      }

      // 更新任务状态
      const result = await db.collection("tasks").updateOne(
        { _id: new ObjectId(taskId as string), "participants.address": address },
        {
          $set: {
            "participants.$.status": "submitted",
            status: "pending_approval", // 添加这行
          },
        },
      );

      if (result.modifiedCount === 0) {
        console.log("任务状态未更新:", { taskId, address });
        return NextResponse.json({ message: "任务状态未更改，可能是因为已经是提交状态" }, { status: 400 });
      }

      console.log("任务提交成功:", { taskId, address });
      return NextResponse.json({ message: "任务已提交审核", status: "success" });
    } catch (error) {
      console.error("提交任务时出错:", error);
      return NextResponse.json({ message: "提交任务失败", error: (error as Error).message }, { status: 500 });
    }
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const taskId = searchParams.get("taskId");
  const address = searchParams.get("address");

  try {
    const client = await clientPromise;
    const db = client.db("taskcube");

    // 如果是请求用户数据
    if (address && !taskId) {
      // 获取用户数据
      const user = await db.collection("users").findOne({ address });

      // 获取用户的任务数据
      const publishedTasks = await db.collection("tasks").find({ creatorAddress: address }).toArray();
      const acceptedTasks = await db.collection("tasks").find({ "participants.address": address }).toArray();

      // 获取用户的奖励分配记录
      const distributions = await db
        .collection("rewardDistributions")
        .find({
          $or: [
            { participantAddress: address },
            { directInviterAddress: address },
            { indirectInviterAddress: address },
          ],
        })
        .toArray();

      // 计算总奖励
      let totalBounty = 0;
      distributions.forEach(dist => {
        if (dist.participantAddress === address) totalBounty += dist.userReward;
        if (dist.directInviterAddress === address) totalBounty += dist.directInviterReward;
        if (dist.indirectInviterAddress === address) totalBounty += dist.indirectInviterReward;
      });

      return NextResponse.json({
        success: true,
        user: {
          ...user,
          bounty: totalBounty,
          balance: user?.balance || 0,
          level: user?.level || "Initiate",
        },
        publishedTasks,
        acceptedTasks,
        distributions,
      });
    }

    // 原有的任务查询逻辑
    if (taskId) {
      const task = await db.collection("tasks").findOne({ _id: new ObjectId(taskId) });
      if (task) {
        return NextResponse.json({
          success: true,
          task: {
            ...task,
            taskCount: task.taskCount || 0,
            onChainTaskId: task.onChainTaskId, // 确保返回 onChainTaskId
          },
        });
      } else {
        return NextResponse.json({ success: false, message: "Task not found" }, { status: 404 });
      }
    }

    // 获取所有任务
    const tasks = await db.collection("tasks").find().sort({ createdAt: -1 }).toArray();
    return NextResponse.json(tasks);
  } catch (error) {
    console.error("API 错误:", error);
    return NextResponse.json(
      {
        success: false,
        message: "获取数据失败",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  const body = await request.json();
  const { taskId, address } = body;

  console.log("接收到 PATCH 请求:", body);

  if (!taskId || !address) {
    return NextResponse.json({ message: "taskId 和 address 是必需的" }, { status: 400 });
  }

  try {
    const client = await clientPromise;
    const db = client.db("taskcube");

    const result = await db
      .collection("tasks")
      .updateOne(
        { _id: new ObjectId(String(taskId)) },
        { $addToSet: { participants: { address: address, status: "accepted" } } },
      );

    if (result.matchedCount === 0) {
      return NextResponse.json({ message: "任务不存在" }, { status: 400 });
    }

    if (result.modifiedCount === 0) {
      return NextResponse.json({ message: "用户已经接受了该任务" }, { status: 400 });
    }

    console.log("任务接受成功:", { taskId, address });
    return NextResponse.json({ message: "任务接受成功", status: "success" });
  } catch (error) {
    console.error("接受任务时出错:", error);
    return NextResponse.json({ message: "接受任务失败", error: (error as Error).message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const body = await request.json();
  const { taskId, participantAddress, action } = body;

  console.log("接收到 PUT 请求:", body);

  if (!taskId || !participantAddress || !action) {
    return NextResponse.json({ message: "taskId, participantAddress 和 action 是必需的" }, { status: 400 });
  }

  try {
    const client = await clientPromise;
    const db = client.db("taskcube");

    let updateStatus: string;
    if (action === "approve") {
      updateStatus = "approved";
    } else if (action === "reject") {
      updateStatus = "rejected";
    } else {
      return NextResponse.json({ message: "无效的 action" }, { status: 400 });
    }

    // 获取任务信息
    const task = await db.collection("tasks").findOne({ _id: new ObjectId(taskId as string) });
    if (!task) {
      return NextResponse.json({ message: "任务不存在" }, { status: 404 });
    }

    const updateData: { [key: string]: any } = {
      "participants.$.status": updateStatus,
      status: action === "approve" ? "completed" : "published",
    };

    if (action === "approve") {
      updateData["participants.$.approvedDate"] = new Date();
    }

    const result = await db
      .collection("tasks")
      .updateOne(
        { _id: new ObjectId(taskId as string), "participants.address": participantAddress },
        { $set: updateData },
      );

    if (result.matchedCount === 0) {
      return NextResponse.json({ message: "任务或参与者不存在" }, { status: 404 });
    }

    if (action === "approve") {
      const reward = parseFloat(task.reward) || 0;

      // 确保参与者不是任务创建者
      if (task.creatorAddress !== participantAddress) {
        const session = client.startSession();
        try {
          await session.withTransaction(async () => {
            // 1. 计算基础奖励金额
            const userReward = reward * 0.94; // 94% 给完成任务的用户
            const platformFee = reward * 0; // 0% 平台手续费
            let unclaimedReward = reward * 0.06; // 剩余6%默认为未认领奖励

            // 2. 查找邀请关系并分配邀请奖励
            const invite = await db.collection("invites").findOne({ invitee: participantAddress });
            if (invite) {
              // 更新直接邀请者奖励 (5%)
              await db
                .collection("users")
                .updateOne({ address: invite.inviter }, { $inc: { bounty: reward * 0.05 } }, { upsert: true, session });
              unclaimedReward -= reward * 0.05;

              // 查找并更新二级邀请者奖励 (1%)
              const secondLevelInvite = await db.collection("invites").findOne({ invitee: invite.inviter });
              if (secondLevelInvite) {
                await db
                  .collection("users")
                  .updateOne(
                    { address: secondLevelInvite.inviter },
                    { $inc: { bounty: reward * 0.01 } },
                    { upsert: true, session },
                  );
                unclaimedReward -= reward * 0.01;
              }
            }

            // 3. 更新参与者的奖励 (90%)
            await db
              .collection("users")
              .updateOne({ address: participantAddress }, { $inc: { bounty: userReward } }, { upsert: true, session });

            // 4. 更新全局 Bounty
            const globalBountyId = new ObjectId("000000000000000000000000");
            await db.collection("bounties").updateOne(
              { _id: globalBountyId },
              {
                $inc: {
                  amount: reward,
                  platformFee: platformFee,
                  unclaimedReward: unclaimedReward,
                },
              },
              { upsert: true, session },
            );

            // 5. 记录奖励分配
            await db.collection("rewardDistributions").insertOne(
              {
                taskId: task._id,
                participantAddress,
                userReward,
                platformFee,
                directInviterAddress: invite?.inviter || null,
                directInviterReward: invite ? reward * 0.05 : 0,
                indirectInviterAddress: invite
                  ? (await db.collection("invites").findOne({ invitee: invite.inviter }))?.inviter || null
                  : null,
                indirectInviterReward:
                  invite && (await db.collection("invites").findOne({ invitee: invite.inviter })) ? reward * 0.01 : 0,
                unclaimedReward,
                distributedAt: new Date(),
              },
              { session },
            );
          });
        } finally {
          await session.endSession();
        }
      }

      return NextResponse.json({ success: true, message: "任务已批准并完成", reward });
    } else {
      return NextResponse.json({ success: true, message: "任务已拒绝" });
    }
  } catch (error) {
    console.error(`${action === "approve" ? "批准" : "拒绝"}任务失败:`, error);
    return NextResponse.json(
      { success: false, message: `${action === "approve" ? "批准" : "拒绝"}任务失败` },
      { status: 500 },
    );
  }
}
