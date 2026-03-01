export const dynamic = "force-dynamic";

import { getRawDb } from "@/db/raw";
import Link from "next/link";

const PAGE_SIZE = 50;

interface Props {
  searchParams: Promise<{ table?: string; page?: string }>;
}

export default async function DatabasePage({ searchParams }: Props) {
  const { table: selectedTable, page: pageParam } = await searchParams;
  const db = getRawDb();

  // Get all user tables (exclude drizzle internal)
  const tables = (
    db
      .prepare(
        `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE '__drizzle%' ORDER BY name`
      )
      .all() as { name: string }[]
  ).map((r) => r.name);

  const activeTable = selectedTable && tables.includes(selectedTable) ? selectedTable : tables[0];

  const currentPage = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);
  const offset = (currentPage - 1) * PAGE_SIZE;

  let columns: string[] = [];
  let rows: Record<string, unknown>[] = [];
  let totalRows = 0;

  if (activeTable) {
    // Get column names via PRAGMA
    const colInfo = db.prepare(`PRAGMA table_info("${activeTable}")`).all() as {
      name: string;
    }[];
    columns = colInfo.map((c) => c.name);

    totalRows = (
      db.prepare(`SELECT COUNT(*) as cnt FROM "${activeTable}"`).get() as { cnt: number }
    ).cnt;

    rows = db
      .prepare(`SELECT * FROM "${activeTable}" LIMIT ${PAGE_SIZE} OFFSET ${offset}`)
      .all() as Record<string, unknown>[];
  }

  const totalPages = Math.ceil(totalRows / PAGE_SIZE);

  function pageHref(p: number) {
    return `/admin/database?table=${activeTable}&page=${p}`;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Database Browser</h1>
        <span className="text-xs text-slate-400 bg-slate-100 px-2 py-1 rounded-full">
          Read-only
        </span>
      </div>

      {/* Table tabs */}
      <div className="flex gap-1 flex-wrap mb-6 border-b border-slate-200 pb-0">
        {tables.map((t) => (
          <Link
            key={t}
            href={`/admin/database?table=${t}&page=1`}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg border border-b-0 transition-colors ${
              t === activeTable
                ? "bg-white border-slate-200 text-amber-700 -mb-px z-10"
                : "bg-slate-50 border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {t}
          </Link>
        ))}
      </div>

      {activeTable && (
        <>
          {/* Meta row */}
          <div className="flex items-center justify-between mb-3 text-sm text-slate-500">
            <span>
              <span className="font-medium text-slate-700">{totalRows.toLocaleString()}</span> rows
              {totalPages > 1 && (
                <> &mdash; page <span className="font-medium text-slate-700">{currentPage}</span> of {totalPages}</>
              )}
            </span>
            <span>{columns.length} columns</span>
          </div>

          {/* Table */}
          <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-sm">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  {columns.map((col) => (
                    <th
                      key={col}
                      className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap"
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={columns.length}
                      className="px-4 py-10 text-center text-slate-400"
                    >
                      No rows
                    </td>
                  </tr>
                ) : (
                  rows.map((row, i) => (
                    <tr
                      key={i}
                      className={`border-b border-slate-100 last:border-0 ${
                        i % 2 === 0 ? "bg-white" : "bg-slate-50/50"
                      }`}
                    >
                      {columns.map((col) => {
                        const val = row[col];
                        const display =
                          val === null || val === undefined
                            ? null
                            : String(val);
                        return (
                          <td
                            key={col}
                            className="px-4 py-2 text-slate-700 whitespace-nowrap max-w-xs truncate align-top"
                            title={display ?? ""}
                          >
                            {display === null ? (
                              <span className="text-slate-300 italic">null</span>
                            ) : (
                              display
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <Link
                href={pageHref(currentPage - 1)}
                className={`px-4 py-2 text-sm font-medium rounded-lg border border-slate-300 transition-colors ${
                  currentPage === 1
                    ? "opacity-40 pointer-events-none bg-white text-slate-400"
                    : "bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                Previous
              </Link>
              <span className="text-sm text-slate-500">
                {currentPage} / {totalPages}
              </span>
              <Link
                href={pageHref(currentPage + 1)}
                className={`px-4 py-2 text-sm font-medium rounded-lg border border-slate-300 transition-colors ${
                  currentPage === totalPages
                    ? "opacity-40 pointer-events-none bg-white text-slate-400"
                    : "bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                Next
              </Link>
            </div>
          )}
        </>
      )}
    </div>
  );
}
