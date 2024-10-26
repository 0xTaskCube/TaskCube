import { NextRequest, NextResponse } from "next/server";
import clientPromise from "../../../../lib/mongodb";

type LevelType = "Initiate" | "Operative" | "Enforcer" | "Vanguard" | "Prime";

interface UserCheckInData {
  address: string;
  consecutiveDays: number;
  lastCheckIn: string | null;
  level: LevelType;
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

    const userData = (await userCollection.findOne({ address })) as UserCheckInData | null;

    if (!userData) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const now = new Date();
    const lastCheckIn = userData.lastCheckIn ? new Date(userData.lastCheckIn) : null;

    if (!lastCheckIn) {
      return NextResponse.json({ error: "No previous check-in found" }, { status: 400 });
    }

    const daysSinceLastCheckIn = Math.floor((now.getTime() - lastCheckIn.getTime()) / (1000 * 60 * 60 * 24));

    let makeupDaysAllowed = 0;
    switch (userData.level) {
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

    let consecutiveDays = userData.consecutiveDays + daysSinceLastCheckIn;
    let level: LevelType = userData.level;

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
  } catch (error) {
    console.error("补签失败:", error);
    return NextResponse.json({ error: "Failed to make up check-in" }, { status: 500 });
  }
}
