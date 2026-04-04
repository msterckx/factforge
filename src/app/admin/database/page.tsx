export const dynamic = "force-dynamic";

import { getRawDb } from "@/db/raw";
import Link from "next/link";
import DatabaseActions from "@/components/DatabaseActions";
import DatabaseTableClient from "@/components/DatabaseTableClient";

const PAGE_SIZE = 50;

// Tables that support category/subcategory filtering and inline editing
const EDITABLE_TABLES = ["questions", "question_translations"];

interface Props {
  searchParams: Promise<{
    table?:       string;
    page?:        string;
    category?:    string;
    subcategory?: string;
  }>;
}

export default async function DatabasePage({ searchParams }: Props) {
  const { table: selectedTable, page: pageParam, category, subcategory } = await searchParams;
  const db = getRawDb();

  // All user tables (exclude drizzle internals)
  const tables = (
    db
      .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE '__drizzle%' ORDER BY name`)
      .all() as { name: string }[]
  ).map((r) => r.name);

  const activeTable  = selectedTable && tables.includes(selectedTable) ? selectedTable : tables[0];
  const currentPage  = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);
  const offset       = (currentPage - 1) * PAGE_SIZE;
  const filterCatId  = category    ? Number(category)    : null;
  const filterSubId  = subcategory ? Number(subcategory) : null;
  const canEdit      = EDITABLE_TABLES.includes(activeTable ?? "");

  let columns:      string[]                                    = [];
  let rows:         Record<string, unknown>[]                   = [];
  let totalRows     = 0;
  let categories:   { id: number; name: string }[]             = [];
  let subcategories: { id: number; name: string; categoryId: number }[] = [];

  if (activeTable) {
    const colInfo = db.prepare(`PRAGMA table_info("${activeTable}")`).all() as { name: string }[];
    columns = colInfo.map((c) => c.name);

    // Fetch category/subcategory lists for filterable tables
    if (canEdit) {
      categories    = db.prepare(`SELECT id, name FROM categories ORDER BY name`).all() as typeof categories;
      subcategories = db
        .prepare(`SELECT id, name, category_id AS categoryId FROM subcategories ORDER BY name`)
        .all() as typeof subcategories;
    }

    if (activeTable === "questions") {
      const where  = buildWhere({ catId: filterCatId, subId: filterSubId });
      totalRows    = (db.prepare(`SELECT COUNT(*) AS cnt FROM questions${where.sql}`).get(...where.params) as { cnt: number }).cnt;
      rows         = db.prepare(`SELECT * FROM questions${where.sql} LIMIT ${PAGE_SIZE} OFFSET ${offset}`).all(...where.params) as typeof rows;

    } else if (activeTable === "question_translations") {
      // Join with questions so we can filter by category/subcategory
      const where  = buildWhere({ catId: filterCatId, subId: filterSubId, prefix: "q." });
      const join   = `FROM question_translations qt JOIN questions q ON q.id = qt.question_id${where.sql}`;
      totalRows    = (db.prepare(`SELECT COUNT(*) AS cnt ${join}`).get(...where.params) as { cnt: number }).cnt;
      rows         = db.prepare(`SELECT qt.* ${join} LIMIT ${PAGE_SIZE} OFFSET ${offset}`).all(...where.params) as typeof rows;

    } else {
      totalRows = (db.prepare(`SELECT COUNT(*) AS cnt FROM "${activeTable}"`).get() as { cnt: number }).cnt;
      rows      = db.prepare(`SELECT * FROM "${activeTable}" LIMIT ${PAGE_SIZE} OFFSET ${offset}`).all() as typeof rows;
    }
  }

  const totalPages = Math.ceil(totalRows / PAGE_SIZE);

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-3">
          <h1 className="text-2xl font-bold text-slate-800">Database Browser</h1>
          {canEdit ? (
            <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
              Editable
            </span>
          ) : (
            <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
              Read-only
            </span>
          )}
        </div>
        <DatabaseActions />
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
        <DatabaseTableClient
          key={`${activeTable}-${filterCatId}-${filterSubId}-${currentPage}`}
          tableName={activeTable}
          columns={columns}
          rows={rows}
          totalRows={totalRows}
          currentPage={currentPage}
          totalPages={totalPages}
          canEdit={canEdit}
          categories={categories}
          subcategoriesData={subcategories}
          filterCategory={filterCatId}
          filterSubcategory={filterSubId}
        />
      )}
    </div>
  );
}

// ── SQL WHERE builder ────────────────────────────────────────────────────────
function buildWhere(opts: {
  catId:  number | null;
  subId:  number | null;
  prefix?: string;        // e.g. "q." for joined queries
}): { sql: string; params: number[] } {
  const { catId, subId, prefix = "" } = opts;
  const clauses: string[] = [];
  const params:  number[] = [];

  if (catId) { clauses.push(`${prefix}category_id = ?`);    params.push(catId); }
  if (subId) { clauses.push(`${prefix}subcategory_id = ?`); params.push(subId); }

  return {
    sql:    clauses.length ? ` WHERE ${clauses.join(" AND ")}` : "",
    params,
  };
}
