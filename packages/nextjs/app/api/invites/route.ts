import { NextRequest, NextResponse } from "next/server";
import clientPromise from "../../../lib/mongodb";

export async function POST(request: NextRequest) {
  const { inviter, invitee } = await request.json();

  try {
    const client = await clientPromise;
    const db = client.db("taskcube");

    const existingInvite = await db.collection("invites").findOne({ invitee });
    if (existingInvite) {
      return NextResponse.json({ message: "This wallet address has already been invited", status: "error" });
    }

    const result = await db.collection("invites").insertOne({
      inviter,
      invitee,
      createdAt: new Date(),
    });

    return NextResponse.json({ message: "Invitation data saved successfully", result, status: "success" });
  } catch (error) {
    return NextResponse.json({ message: "Failed to save invitation data", error: (error as Error).message });
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const inviter = searchParams.get("inviter");
  const invitee = searchParams.get("invitee");

  try {
    const client = await clientPromise;
    const db = client.db("taskcube");

    if (invitee) {
      const invite = await db.collection("invites").findOne({ invitee });
      if (invite) {
        return NextResponse.json({ status: "invited", inviter: invite.inviter });
      } else {
        return NextResponse.json({ status: "not_invited" });
      }
    }

    if (inviter) {
      const invites = await db.collection("invites").find({ inviter }).toArray();

      const result = await Promise.all(
        invites.map(async invite => {
          const deposits = await db
            .collection("transactions")
            .find({
              userAddress: invite.invitee,
              type: "deposit",
              status: "completed",
            })
            .toArray();

          const totalDeposits = deposits.reduce((sum, deposit) => sum + parseFloat(deposit.amount), 0);

          const secondLevelInvites = await db.collection("invites").find({ inviter: invite.invitee }).toArray();

          const children = await Promise.all(
            secondLevelInvites.map(async secondInvite => {
              const secondDeposits = await db
                .collection("transactions")
                .find({
                  userAddress: secondInvite.invitee,
                  type: "deposit",
                  status: "completed",
                })
                .toArray();

              const secondTotalDeposits = secondDeposits.reduce((sum, deposit) => sum + parseFloat(deposit.amount), 0);

              return {
                invitee: secondInvite.invitee,
                balance: secondTotalDeposits.toFixed(2),
              };
            }),
          );

          return {
            invitee: invite.invitee,
            balance: totalDeposits.toFixed(2),
            children: children,
          };
        }),
      );

      return NextResponse.json({ inviter, invites: result });
    }

    return NextResponse.json({ message: "Missing required parameters", status: "error" });
  } catch (error) {
    return NextResponse.json({ message: "Failed to fetch invites", error: (error as Error).message });
  }
}
