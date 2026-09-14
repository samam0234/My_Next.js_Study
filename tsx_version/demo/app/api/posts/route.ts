import { NextResponse } from "next/server";
import { SAMPLE_POSTS } from "@/lib/sample-posts";

export async function GET() {
  return NextResponse.json({ posts: SAMPLE_POSTS });
}
