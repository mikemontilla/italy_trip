import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getExpense, deleteExpense } from "@/lib/expenses";

/**
 * @openapi
 * /events/{id}/expenses/{expenseId}:
 *   get:
 *     tags: [Expenses]
 *     summary: Get full detail of an expense (payers + splits)
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: integer }
 *       - name: expenseId
 *         in: path
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Expense with payers and splits }
 *       401: { description: Not authenticated }
 *       404: { description: Expense not found or caller has no access }
 *   delete:
 *     tags: [Expenses]
 *     summary: Delete an expense (admin of the event or the participant who created it)
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: integer }
 *       - name: expenseId
 *         in: path
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       204: { description: Deleted }
 *       401: { description: Not authenticated }
 *       403: { description: Caller is neither admin nor creator }
 *       404: { description: Expense not found }
 */
export async function GET(_request, ctx) {
  const session = await auth();
  if (!session?.user?.dbUserId) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const { expenseId } = await ctx.params;
  const parsed = Number.parseInt(expenseId, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }

  const expense = await getExpense(parsed, session.user.dbUserId);
  if (!expense) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json(expense);
}

export async function DELETE(_request, ctx) {
  const session = await auth();
  if (!session?.user?.dbUserId) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const { expenseId } = await ctx.params;
  const parsed = Number.parseInt(expenseId, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }

  const result = await deleteExpense(parsed, session.user.dbUserId);
  if (result.error === "not_found") {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (result.error === "forbidden") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  return new Response(null, { status: 204 });
}
