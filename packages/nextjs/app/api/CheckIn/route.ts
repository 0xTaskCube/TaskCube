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
      return NextResponse.json({
        address,
        consecutiveDays: 0,
        lastCheckIn: null,
        level: "Initiate" as LevelType,
        canCheckIn: true,
      });
    }

    const canCheckIn =
      !userData.lastCheckIn || new Date().getTime() - new Date(userData.lastCheckIn).getTime() > 24 * 60 * 60 * 1000;

    return NextResponse.json({
      ...userData,
      canCheckIn,
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
      const consecutiveDays = (userData?.consecutiveDays || 0) + 1;
      let level: LevelType = "Initiate";

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

      if (result.modifiedCount === 1 || result.upsertedCount === 1) {
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

export async function makeup(request: NextRequest) {
  const { address } = await request.json();
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

    const makeupDays = {
      Operative: 1,
      Enforcer: 3,
      Vanguard: 5,
      Prime: 7,
    };

    if (!makeupDays[userData.level as keyof typeof makeupDays]) {
      return NextResponse.json({ error: "Not eligible for makeup" }, { status: 400 });
    }

    const now = new Date();
    const daysSinceLastCheckIn = Math.floor(
      (now.getTime() - new Date(userData.lastCheckIn!).getTime()) / (24 * 60 * 60 * 1000),
    );

    if (daysSinceLastCheckIn <= makeupDays[userData.level as keyof typeof makeupDays]) {
      const consecutiveDays = userData.consecutiveDays + daysSinceLastCheckIn;
      let level = userData.level;

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
      );

      if (result.modifiedCount === 1) {
        return NextResponse.json({ success: true, consecutiveDays, level });
      } else {
        throw new Error("Failed to update user data");
      }
    } else {
      return NextResponse.json({ error: "Makeup period expired" }, { status: 400 });
    }
  } catch (error) {
    console.error("补签失败:", error);
    return NextResponse.json({ error: "Failed to make up check-in" }, { status: 500 });
  }
}
