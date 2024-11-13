import { NextResponse } from "next/server";
import clientPromise from "../../../lib/mongodb";

export async function GET() {
  try {
    const client = await clientPromise;
    const db = client.db("taskcube");
    const collection = db.collection("testCollection");

    await collection.insertOne({ name: "test data", createdAt: new Date() });

    const data = await collection.find({}).toArray();

    return NextResponse.json({ message: "Data insertion successful!", data });
  } catch (error: unknown) {
    console.error("Operation failed:", error);
    const errorMessage = error instanceof Error ? error.message : "unknown error";
    return NextResponse.json({ message: "Operation failed", error: errorMessage });
  }
}
