import { NextRequest, NextResponse } from "next/server";
import { cancelAndRestockOrder } from "@/lib/inventory/deduction";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    // Verify admin authentication
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized. Admin privileges required." },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const orderRef = String(body.orderRef || "").trim();

    if (!orderRef) {
      return NextResponse.json(
        { error: "orderRef is required." },
        { status: 400 }
      );
    }

    const result = await cancelAndRestockOrder(orderRef);

    if (!result.success) {
      return NextResponse.json(
        { error: result.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: result.message,
      alreadyCancelled: result.alreadyCancelled,
    });
  } catch (err: unknown) {
    console.error("[POST /api/admin/orders/cancel] Error:", err);
    return NextResponse.json(
      { error: "Failed to cancel and restock order." },
      { status: 500 }
    );
  }
}
