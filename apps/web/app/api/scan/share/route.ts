import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { scanId, action } = await request.json() as {
    scanId: string;
    action: "enable" | "disable";
  };

  if (!scanId || !action) {
    return NextResponse.json({ error: "scanId and action are required" }, { status: 400 });
  }

  // Verify scan belongs to user
  const { data: scan } = await supabase
    .from("scans")
    .select("id, share_token")
    .eq("id", scanId)
    .eq("user_id", user.id)
    .single();

  if (!scan) {
    return NextResponse.json({ error: "Scan not found" }, { status: 404 });
  }

  if (action === "enable") {
    // Generate token if not already set
    const token = scan.share_token ?? randomBytes(16).toString("hex");

    await supabase
      .from("scans")
      .update({ is_public: true, share_token: token })
      .eq("id", scanId);

    return NextResponse.json({ success: true, token });
  }

  if (action === "disable") {
    await supabase
      .from("scans")
      .update({ is_public: false, share_token: null })
      .eq("id", scanId);

    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
