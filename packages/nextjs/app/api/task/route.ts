import { NextRequest, NextResponse } from "next/server";
import clientPromise from "../../../lib/mongodb";
import { ObjectId } from "mongodb";

export async function POST(request: NextRequest) {
  const body = await request.json();

  if (body.title) {
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
      return NextResponse.json({ message: "All fields are required" }, { status: 400 });
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
        twitterAccount: body.twitterAccount || "",
        telegramAccount: body.telegramAccount || "",
      };

      const result = await db.collection("tasks").insertOne(newTask);

      if (result.insertedId) {
        return NextResponse.json({
          message: "Task published successfully",
          taskId: result.insertedId,
          status: "success",
        });
      } else {
        throw new Error("Failed to insert task");
      }
    } catch (error) {
      console.error("An error occurred while publishing the task:", error);
      return NextResponse.json({ message: "Publishing task failed", error: (error as Error).message }, { status: 500 });
    }
  } else {
    const { taskId, address } = body;

    if (!taskId || !address) {
      return NextResponse.json({ message: "taskId and address is required" }, { status: 400 });
    }

    try {
      const client = await clientPromise;
      const db = client.db("taskcube");

      const task = await db.collection("tasks").findOne({ _id: new ObjectId(taskId as string) });

      if (!task) {
        console.log("Task does not exist:", taskId);
        return NextResponse.json({ message: "Task does not exist" }, { status: 400 });
      }

      const participantIndex = task.participants.findIndex((p: any) => p.address === address);

      if (participantIndex === -1) {
        console.log("The user is not involved in the task:", { taskId, address });
        return NextResponse.json({ message: "The user is not involved in the task" }, { status: 400 });
      }

      if (task.participants[participantIndex].status === "submitted") {
        console.log("The task has been submitted:", { taskId, address });
        return NextResponse.json({ message: "The task has been submitted" }, { status: 400 });
      }

      const result = await db.collection("tasks").updateOne(
        { _id: new ObjectId(taskId as string), "participants.address": address },
        {
          $set: {
            "participants.$.status": "submitted",
            status: "pending_approval",
          },
        },
      );

      if (result.modifiedCount === 0) {
        console.log("Task status not updated:", { taskId, address });
        return NextResponse.json(
          { message: "The task status has not changed, probably because it is already submitted" },
          { status: 400 },
        );
      }

      console.log("Task submitted successfully:", { taskId, address });
      return NextResponse.json({ message: "The task has been submitted for review", status: "success" });
    } catch (error) {
      console.error("Error submitting task:", error);
      return NextResponse.json({ message: "Failed to submit task", error: (error as Error).message }, { status: 500 });
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

    if (address && !taskId) {
      const user = await db.collection("users").findOne({ address });

      const publishedTasks = await db.collection("tasks").find({ creatorAddress: address }).toArray();
      const acceptedTasks = await db.collection("tasks").find({ "participants.address": address }).toArray();

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

    if (taskId) {
      const task = await db.collection("tasks").findOne({ _id: new ObjectId(taskId) });
      if (task) {
        return NextResponse.json({
          success: true,
          task: {
            ...task,
            taskCount: task.taskCount || 0,
            onChainTaskId: task.onChainTaskId,
          },
        });
      } else {
        return NextResponse.json({ success: false, message: "Task not found" }, { status: 404 });
      }
    }

    const tasks = await db.collection("tasks").find().sort({ createdAt: -1 }).toArray();
    return NextResponse.json(tasks);
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Failed to get data",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  const body = await request.json();
  const { taskId, address } = body;

  if (!taskId || !address) {
    return NextResponse.json({ message: "taskId and address is required" }, { status: 400 });
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
      return NextResponse.json({ message: "Task does not exist" }, { status: 400 });
    }

    if (result.modifiedCount === 0) {
      return NextResponse.json({ message: "The user has accepted the task" }, { status: 400 });
    }

    console.log("Task accepted successfully:", { taskId, address });
    return NextResponse.json({ message: "Task accepted successfully", status: "success" });
  } catch (error) {
    console.error("Error accepting task:", error);
    return NextResponse.json({ message: "Error accepting task", error: (error as Error).message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const body = await request.json();
  const { taskId, participantAddress, action } = body;

  if (!taskId || !participantAddress || !action) {
    return NextResponse.json({ message: "taskId, participantAddress and action is required" }, { status: 400 });
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
      return NextResponse.json({ message: "Invalid action" }, { status: 400 });
    }

    const task = await db.collection("tasks").findOne({ _id: new ObjectId(taskId as string) });
    if (!task) {
      return NextResponse.json({ message: "Task does not exist" }, { status: 404 });
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
      return NextResponse.json({ message: "Task or participant does not exist" }, { status: 404 });
    }

    if (action === "approve") {
      const reward = parseFloat(task.reward) || 0;

      if (task.creatorAddress !== participantAddress) {
        const session = client.startSession();
        try {
          await session.withTransaction(async () => {
            // Reward distribution
            const userReward = reward * 0.94;
            const platformFee = reward * 0;
            let unclaimedReward = reward * 0.06;

            const invite = await db.collection("invites").findOne({ invitee: participantAddress });
            if (invite) {
              await db
                .collection("users")
                .updateOne({ address: invite.inviter }, { $inc: { bounty: reward * 0.05 } }, { upsert: true, session });
              unclaimedReward -= reward * 0.05;

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

            await db
              .collection("users")
              .updateOne({ address: participantAddress }, { $inc: { bounty: userReward } }, { upsert: true, session });

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

            if (task.onChainTaskId) {
              await db.collection("contractCalls").insertOne(
                {
                  taskId: task._id,
                  type: "markTaskCompleted",
                  onChainTaskId: task.onChainTaskId,
                  status: "pending",
                  createdAt: new Date(),
                },
                { session },
              );
            }
          });
        } finally {
          await session.endSession();
        }
      }

      return NextResponse.json({
        success: true,
        message: "Task approved and completed",
        reward,
        needsContractCall: task.onChainTaskId ? true : false,
      });
    } else {
      return NextResponse.json({ success: true, message: "Task rejected" });
    }
  } catch (error) {
    console.error(`${action === "approve" ? "approve" : "reject"}Task failed:`, error);
    return NextResponse.json(
      { success: false, message: `${action === "approve" ? "approve" : "reject"}Task failed` },
      { status: 500 },
    );
  }
}
