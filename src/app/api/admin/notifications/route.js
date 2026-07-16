import { query } from "@/lib/db.js";
import { requireApi, json } from "@/lib/auth.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/admin/notifications?after=<id>
//
// Backs the header bell. Notifications ARE the audit trail — the same rows that
// used to render as "Recent activity" — so there is no second store to keep in
// sync.
//
// The cursor is audit_log.id, not created_at: the id is a monotonic BIGINT
// primary key, whereas created_at is a zone-less DATETIME that would have to be
// round-tripped through the Node process's local timezone, shifting it and
// silently skipping or repeating rows.
export async function GET(req) {
  const guard = await requireApi({ role: "super_admin" });
  if (guard.error) return guard.error;

  const { searchParams } = new URL(req.url);
  const limit = Math.min(Math.max(Number(searchParams.get("limit")) || 20, 1), 50);

  // Only accept a positive integer cursor; anything else is treated as "no
  // cursor" rather than being interpolated into the query.
  const afterRaw = Number(searchParams.get("after"));
  const after = Number.isSafeInteger(afterRaw) && afterRaw > 0 ? afterRaw : null;

  const rows = await query(
    `SELECT id, action, entity, entity_id, actor_email, created_at
       FROM audit_log
      ${after ? "WHERE id > :after" : ""}
      ORDER BY id DESC
      LIMIT ${limit}`,
    after ? { after } : {}
  );

  return json({
    notifications: rows.map((r) => ({
      id: String(r.id),
      action: r.action,
      entity: r.entity,
      entity_id: r.entity_id,
      actor: r.actor_email || "system",
      created_at: r.created_at,
    })),
    // Newest id seen, for the client's next poll. Falls back to the incoming
    // cursor so an empty poll doesn't reset the client to the beginning.
    cursor: rows.length ? String(rows[0].id) : after ? String(after) : null,
  });
}
