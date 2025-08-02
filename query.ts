import { Database, type SQLQueryBindings } from "bun:sqlite";

const db = new Database("hospital.db");

// SELECT * from sqlite_master
const rows = db.query("SELECT * from sqlite_master").all() as IRows[];

function extractSchema(entries: IRows[]) {
  return (
    entries
      .filter((entry) => entry.type === "table" && entry.sql) // Only tables with SQL defined
      .map((entry) => entry.sql.trim()) // Clean up the SQL string
      .join(";\n\n") + ";"
  ); // Join with semicolons
}
let schema = extractSchema(rows);
console.log(schema);

// * types
interface IRows {
  type: "table" | "index" | "trigger" | "view";
  name: string;
  tbl_name: string;
  rootpage: number;
  sql: string;
}
