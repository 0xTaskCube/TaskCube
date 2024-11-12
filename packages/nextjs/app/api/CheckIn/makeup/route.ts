import { NextRequest, NextResponse } from "next/server";
import clientPromise from "../../../../lib/mongodb";

type LevelType = "Initiate" | "Operative" | "Enforcer" | "Vanguard" | "Prime";

interface UserCheckInData {
  address: string;
  consecutiveDays: number;
  lastCheckIn: string | null;
  level: LevelType;
  lastMakeup?: string;
}

function getUTC8Date(date: Date): Date {
  return new Date(date.getTime() + 8 * 60 * 60 * 1000);
}

export async function POST(request: NextRequest) {
  const { address, level } = await request.json();

  if (!address) {
    return NextResponse.json({ error: "Address is required" }, { status: 400 });
  }

  try {
    const client = await clientPromise;
    const db = client.db("taskcube");
    const userCollection = db.collection("users");

    const userData = (await userCollection.findOne({ address })) as UserCheckInData | null;

    if (!userData) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const now = new Date();
    const currentMonth = getUTC8Date(now).toISOString().slice(0, 7);

    // 检查本月是否已经补签过
    if (userData.lastMakeup === currentMonth) {
      return NextResponse.json({ error: "Already made up this month" }, { status: 400 });
    }

    const lastCheckIn = userData.lastCheckIn ? new Date(userData.lastCheckIn) : null;
    if (!lastCheckIn) {
      return NextResponse.json({ error: "No previous check-in found" }, { status: 400 });
    }

    const daysSinceLastCheckIn = Math.floor(
      (getUTC8Date(now).getTime() - getUTC8Date(lastCheckIn).getTime()) / (1000 * 60 * 60 * 24),
    );

    // 获取允许的补签天数
    let makeupDaysAllowed = 0;
    switch (level) {
      case "Prime":
        makeupDaysAllowed = 7;
        break;
      case "Vanguard":
        makeupDaysAllowed = 5;
        break;
      case "Enforcer":
        makeupDaysAllowed = 3;
        break;
      case "Operative":
        makeupDaysAllowed = 1;
        break;
      default:
        makeupDaysAllowed = 0;
    }

    if (daysSinceLastCheckIn > makeupDaysAllowed) {
      return NextResponse.json({ error: "Makeup period expired" }, { status: 400 });
    }

    let newConsecutiveDays = userData.consecutiveDays + daysSinceLastCheckIn;
    if (newConsecutiveDays > 100) {
      newConsecutiveDays = 100;
    }

    const result = await userCollection.updateOne(
      { address },
      {
        $set: {
          lastCheckIn: now.toISOString(),
          consecutiveDays: newConsecutiveDays,
          lastMakeup: currentMonth,
          level,
        },
      },
    );

    if (result.modifiedCount === 1) {
      return NextResponse.json({
        success: true,
        consecutiveDays: newConsecutiveDays,
        level,
      });
    } else {
      throw new Error("Failed to update user data");
    }
  } catch (error) {
    console.error("补签失败:", error);
    return NextResponse.json({ error: "Failed to make up check-in" }, { status: 500 });
  }
}
