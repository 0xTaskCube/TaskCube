import { NextRequest, NextResponse } from "next/server";
import clientPromise from "../../../lib/mongodb";

type LevelType = "Initiate" | "Operative" | "Enforcer" | "Vanguard" | "Prime";

interface UserCheckInData {
  address: string;
  consecutiveDays: number;
  lastCheckIn: string | null;
  level: LevelType;
}

export async function GET(request: NextRequest) {
  const address = request.nextUrl.searchParams.get("address");
  if (!address) {
    return NextResponse.json({ error: "Address is required" }, { status: 400 });
  }

  try {
    const client = await clientPromise;
    const db = client.db("taskcube");
    const userCollection = db.collection("users");

    const userData = (await userCollection.findOne({ address })) as UserCheckInData | null;

    if (!userData) {
      return NextResponse.json({ consecutiveDays: 0, lastCheckIn: null, canCheckIn: true, level: "Initiate" });
    }

    const now = new Date();
    const lastCheckIn = userData.lastCheckIn ? new Date(userData.lastCheckIn) : null;
    const canCheckIn = !lastCheckIn || now.getTime() - lastCheckIn.getTime() > 24 * 60 * 60 * 1000;

    return NextResponse.json({
      consecutiveDays: userData.consecutiveDays,
      lastCheckIn: userData.lastCheckIn,
      canCheckIn,
      level: userData.level,
    });
  } catch (error) {
    console.error("获取签到状态失败:", error);
    return NextResponse.json({ error: "Failed to get check-in status" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const { address } = await request.json();

  if (!address) {
    return NextResponse.json({ error: "Address is required" }, { status: 400 });
  }

  try {
    const client = await clientPromise;
    const db = client.db("taskcube");
    const userCollection = db.collection("users");

    const now = new Date();
    const userData = (await userCollection.findOne({ address })) as UserCheckInData | null;

    if (
      !userData ||
      !userData.lastCheckIn ||
      now.getTime() - new Date(userData.lastCheckIn).getTime() > 24 * 60 * 60 * 1000
    ) {
      let consecutiveDays = userData ? userData.consecutiveDays + 1 : 1;
      let level: LevelType = userData ? userData.level : "Initiate";

      if (consecutiveDays >= 100) level = "Prime";
      else if (consecutiveDays >= 75) level = "Vanguard";
      else if (consecutiveDays >= 50) level = "Enforcer";
      else if (consecutiveDays >= 25) level = "Operative";

      const result = await userCollection.updateOne(
        { address },
        {
          $set: {
            lastCheckIn: now.toISOString(),
            consecutiveDays,
            level,
          },
        },
        { upsert: true },
      );

      if (result.upsertedCount === 1 || result.modifiedCount === 1) {
        return NextResponse.json({ success: true, consecutiveDays, level });
      } else {
        throw new Error("Failed to update user data");
      }
    } else {
      return NextResponse.json({ error: "Already checked in today" }, { status: 400 });
    }
  } catch (error) {
    console.error("签到失败:", error);
    return NextResponse.json({ error: "Failed to check in" }, { status: 500 });
  }
}
