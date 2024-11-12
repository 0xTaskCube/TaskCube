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

    // 计算间隔天数
    const diffDays = lastCheckIn ? Math.floor((now.getTime() - lastCheckIn.getTime()) / (1000 * 60 * 60 * 24)) : 0;
    // 获取允许的补签天数
    let allowedMakeupDays = 0;
    switch (userData.level) {
      case "Prime":
        allowedMakeupDays = 7;
        break;
      case "Vanguard":
        allowedMakeupDays = 5;
        break;
      case "Enforcer":
        allowedMakeupDays = 3;
        break;
      case "Operative":
        allowedMakeupDays = 1;
        break;
      default:
        allowedMakeupDays = 0;
    }

    // 修改判断逻辑
    const canCheckIn = (() => {
      if (!userData.lastCheckIn) return true; // 新用户可以签到

      const lastCheckIn = new Date(userData.lastCheckIn);
      const diffDays = Math.floor((now.getTime() - lastCheckIn.getTime()) / (1000 * 60 * 60 * 24));

      // 如果是同一天，不能签到
      if (isSameDay(lastCheckIn, now)) return false;

      // 如果是前一天，可以正常签到
      if (diffDays === 1) return true;

      // 如果间隔多天，且在补签期限内，不显示 GM 按钮
      if (diffDays <= allowedMakeupDays) return false;

      // 超过补签期限，显示 GM 按钮
      return true;
    })();

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
  const { address, level } = await request.json(); // 添加 level 参数

  if (!address) {
    return NextResponse.json({ error: "Address is required" }, { status: 400 });
  }

  try {
    const client = await clientPromise;
    const db = client.db("taskcube");
    const userCollection = db.collection("users");
    const now = new Date();
    const userData = (await userCollection.findOne({ address })) as UserCheckInData | null;

    // 检查是否可以签到
    if (!userData || !userData.lastCheckIn || !isSameDay(new Date(userData.lastCheckIn), now)) {
      let consecutiveDays = 1;

      if (userData?.lastCheckIn) {
        const lastCheckIn = new Date(userData.lastCheckIn);
        const diffTime = getUTC8Date(now).getTime() - getUTC8Date(lastCheckIn).getTime();
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

        if (isConsecutiveDay(lastCheckIn, now)) {
          consecutiveDays = userData.consecutiveDays + 1;
        } else if (diffDays > 1) {
          consecutiveDays = 1;
        }

        if (consecutiveDays > 100) consecutiveDays = 100;
      }

      const result = await userCollection.updateOne(
        { address },
        {
          $set: {
            lastCheckIn: now.toISOString(),
            consecutiveDays,
            level, // 使用传入的 level
          },
        },
        { upsert: true },
      );

      if (result.upsertedCount === 1 || result.modifiedCount === 1) {
        return NextResponse.json({
          success: true,
          consecutiveDays,
          level,
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
