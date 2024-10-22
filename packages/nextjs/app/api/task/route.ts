import { NextRequest, NextResponse } from "next/server";
import clientPromise from "../../../lib/mongodb";
import { ObjectId } from "mongodb";

export async function POST(request: NextRequest) {
  const body = await request.json();
  console.log("收到 POST 请求:", body);

  // 检查是创建新任务还是提交任务
  if (body.title) {
    // 创建新任务
    const { title, description, startDate, endDate, reward, taskType, participationType, creatorAddress } = body;

    if (
      !title ||
      !description ||
      !startDate ||
      !endDate ||
      !reward ||
      !taskType ||
      !participationType ||
      !creatorAddress
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

// ... 保留其他现有的方法（GET, PATCH 等）

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const taskId = searchParams.get("taskId");
  const address = searchParams.get("address");

  console.log("API: 接收到的请求参数", { taskId, address });

  try {
    const client = await clientPromise;
    const db = client.db("taskcube");

    if (taskId) {
      // 获取特定任务
      const task = await db.collection("tasks").findOne({ _id: new ObjectId(taskId) });
      console.log("API: 查询特定任务结果", task);
      if (task) {
        return NextResponse.json(task);
      } else {
        return NextResponse.json({ message: "Task not found" }, { status: 404 });
      }
    } else if (address) {
      // 获取用户的任务
      const publishedTasks = await db.collection("tasks").find({ creatorAddress: address }).toArray();
      const acceptedTasks = await db.collection("tasks").find({ "participants.address": address }).toArray();

      console.log("API: 查询结果", {
        publishedTasksCount: publishedTasks.length,
        acceptedTasksCount: acceptedTasks.length,
      });

      return NextResponse.json({ publishedTasks, acceptedTasks });
    } else {
      // 获取所有任务
      const tasks = await db.collection("tasks").find().sort({ createdAt: -1 }).toArray();
      console.log("API: 查询所有任务结果", { count: tasks.length });
      return NextResponse.json(tasks);
    }
  } catch (error) {
    console.error("API 错误:", error);
    return NextResponse.json({ message: "获取任务失败", error: (error as Error).message }, { status: 500 });
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
        { _id: new ObjectId(taskId) },
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

    let updateStatus;
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

    const result = await db.collection("tasks").updateOne(
      { _id: new ObjectId(taskId as string), "participants.address": participantAddress },
      {
        $set: {
          "participants.$.status": updateStatus,
          status: action === "approve" ? "completed" : "published",
        },
      },
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ message: "任务或参与者不存在" }, { status: 404 });
    }

    if (action === "approve") {
      const reward = task.reward || "0";

      // 确保参与者不是任务创建者
      if (task.creatorAddress !== participantAddress) {
        // 更新参与者的 Bounty
        await db
          .collection("users")
          .updateOne({ address: participantAddress }, { $inc: { bounty: parseFloat(reward) } }, { upsert: true });

        // 更新全局 Bounty
        await updateGlobalBounty(db, parseFloat(reward));
        console.log("全局 Bounty 已更新，增加了:", parseFloat(reward));
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

async function updateGlobalBounty(db: any, reward: number) {
  const globalBountyId = ObjectId.createFromHexString("000000000000000000000000");
  await db.collection("bounties").updateOne({ _id: globalBountyId }, { $inc: { amount: reward } }, { upsert: true });
}
