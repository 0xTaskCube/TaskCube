import { NextRequest, NextResponse } from "next/server";
import clientPromise from "../../../lib/mongodb";

type LevelType = "Initiate" | "Operative" | "Enforcer" | "Vanguard" | "Prime";

interface UserCheckInData {
  address: string;
  consecutiveDays: number;
  lastCheckIn: string | null;
  level: LevelType;
  lastMakeup?: string;
}

// 辅助函数：转换为 UTC+8 时间
function getUTC8Date(date: Date): Date {
  return new Date(date.getTime() + 8 * 60 * 60 * 1000);
}

// 辅助函数：判断是否是同一天 (UTC+8)
function isSameDay(date1: Date, date2: Date): boolean {
  const utc8Date1 = getUTC8Date(date1);
  const utc8Date2 = getUTC8Date(date2);
  return (
    utc8Date1.getFullYear() === utc8Date2.getFullYear() &&
    utc8Date1.getMonth() === utc8Date2.getMonth() &&
    utc8Date1.getDate() === utc8Date2.getDate()
  );
}

// 辅助函数：判断是否是连续的天数
function isConsecutiveDay(lastCheckIn: Date, now: Date): boolean {
  const utc8Last = getUTC8Date(lastCheckIn);
  const utc8Now = getUTC8Date(now);
  const diffTime = utc8Now.getTime() - utc8Last.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  return diffDays === 1;
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

    // 检查是否可以签到（基于 UTC+8 时间）
    const canCheckIn = !lastCheckIn || !isSameDay(lastCheckIn, now);

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

    // 检查是否已经签到（基于 UTC+8 时间）
    if (!userData || !userData.lastCheckIn || !isSameDay(new Date(userData.lastCheckIn), now)) {
      let consecutiveDays = 1; // 默认从1开始

      if (userData?.lastCheckIn) {
        const lastCheckIn = new Date(userData.lastCheckIn);
        const diffTime = getUTC8Date(now).getTime() - getUTC8Date(lastCheckIn).getTime();
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

        if (isConsecutiveDay(lastCheckIn, now)) {
          // 如果是连续签到，增加天数
          consecutiveDays = userData.consecutiveDays + 1;
        } else if (diffDays > 1) {
          // 修改这里：如果间隔超过1天，重置为1天
          consecutiveDays = 1;
        }

        // 最大连续签到天数为100天
        if (consecutiveDays > 100) consecutiveDays = 100;
      }

      const result = await userCollection.updateOne(
        { address },
        {
          $set: {
            lastCheckIn: now.toISOString(),
            consecutiveDays,
            level: userData?.level || "Initiate",
          },
        },
        { upsert: true },
      );

      if (result.upsertedCount === 1 || result.modifiedCount === 1) {
        return NextResponse.json({
          success: true,
          consecutiveDays,
          level: userData?.level || "Initiate",
        });
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
