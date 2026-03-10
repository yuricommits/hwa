import { createClient } from "@/lib/supabase/server";
import { runScan } from "@/lib/engine/runner";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { scanId } = await request.json() as { scanId: string };

  if (!scanId) {
    return NextResponse.json({ error: "scanId is required" }, { status: 400 });
  }

  // Verify scan belongs to user
  const { data: scan } = await supabase
    .from("scans")
    .select("id")
    .eq("id", scanId)
    .eq("user_id", user.id)
    .single();

  if (!scan) {
    return NextResponse.json({ error: "Scan not found" }, { status: 404 });
  }

  // Run analysis — in V1 this is synchronous
  // In V2 this becomes a background job
  await runScan(scanId);

  return NextResponse.json({ success: true });
}
