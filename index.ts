import * as dotenv from "dotenv";
dotenv.config();
import { Database } from "bun:sqlite";

import axios from "axios";
import readline from "readline-sync";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY!;
const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

const db = new Database("hospital.db");

// Initial schema (create tables only if not exist)
db.exec(`
  CREATE TABLE IF NOT EXISTS patients (id INTEGER PRIMARY KEY, name TEXT, dob TEXT);
  CREATE TABLE IF NOT EXISTS appointments (id INTEGER PRIMARY KEY, patient_id INTEGER, date TEXT, doctor_name TEXT);
  CREATE TABLE IF NOT EXISTS bills (id INTEGER PRIMARY KEY, patient_id INTEGER, amount REAL, status TEXT);
`);

// const schemaDescription = `
// Tables:
// patients(id INTEGER, name TEXT, dob TEXT)
// appointments(id INTEGER, patient_id INTEGER, date TEXT, doctor_name TEXT)
// bills(id INTEGER, patient_id INTEGER, amount REAL, status TEXT)
// `;

const schemaRows = db.query("SELECT * from sqlite_master").all() as IRows[];

function extractSchema(entries: IRows[]) {
  return (
    entries
      .filter((entry) => entry.type === "table" && entry.sql) // Only tables with SQL defined
      .map((entry) => entry.sql.trim()) // Clean up the SQL string
      .join(";\n\n") + ";"
  ); // Join with semicolons
}
let schemaDescription = extractSchema(schemaRows);

// * types
interface IRows {
  type: "table" | "index" | "trigger" | "view";
  name: string;
  tbl_name: string;
  rootpage: number;
  sql: string;
}

async function askGemini(prompt: string): Promise<string> {
  const response = await axios.post(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
  });

  const candidates = response.data.candidates;
  const text = candidates?.[0]?.content?.parts?.[0]?.text || "";
  return text.trim();
}

async function generateSQL(naturalQuery: string): Promise<string> {
  const prompt = `You are an assistant that converts natural language to SQL queries.
Use this database schema:

${schemaDescription}

Convert the following user query into an SQLite SQL statement:

"${naturalQuery}"

Only respond with the SQL and donot wrap it in markdown , output just plain text. Do not explain.`;
  return await askGemini(prompt);
}

async function describeResults(
  naturalQuery: string,
  rows: any[]
): Promise<string> {
  const dataSample = JSON.stringify(rows.slice(0, 3), null, 2);
  const prompt = `User asked: "${naturalQuery}".
Here are the query results:\n${dataSample}\n
Summarize the results in simple language.`;

  return await askGemini(prompt);
}

async function main() {
  while (true) {
    const question = readline.question(
      '\nAsk your question (or type "exit"): '
    );
    if (question.toLowerCase() === "exit") break;

    try {
      const sql = await generateSQL(question);
      function removeMarkdownCodeBlock(str: string) {
        return str
          .replace(/```(?:[\w]*)?\n?/g, "") // Remove opening/closing triple backticks with optional language tag
          .replace(/\n?```$/, "") // Handle edge case of closing backticks with newline before
          .trim();
      }
      let cleanedSql = removeMarkdownCodeBlock(sql);
      console.log(`\n🔍 SQL Generated:\n${cleanedSql}`);

      const stmt = db.prepare(sql);
      const rows = stmt.all();

      const summary = await describeResults(question, rows);
      console.log(`\n📝 Explanation:\n${summary}`);
    } catch (err: any) {
      console.error("\n❌ Error:", err.message);
    }
  }
}

main();
