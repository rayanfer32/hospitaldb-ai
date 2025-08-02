import * as dotenv from "dotenv";
dotenv.config();
import { Database } from "bun:sqlite";
import axios from "axios";
import readline from "readline-sync";
import { ConversationManager } from "./conversation";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY!;
const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent";

const db = new Database("hospital.db");

// Initial schema (create tables only if not exist)
db.exec(`
  CREATE TABLE IF NOT EXISTS patients (id INTEGER PRIMARY KEY, name TEXT, dob TEXT);
  CREATE TABLE IF NOT EXISTS appointments (id INTEGER PRIMARY KEY, patient_id INTEGER, date TEXT, doctor_name TEXT);
  CREATE TABLE IF NOT EXISTS bills (id INTEGER PRIMARY KEY, patient_id INTEGER, amount REAL, status TEXT);
`);

const schemaRows = db.query("SELECT * from sqlite_master").all() as IRows[];

function extractSchema(entries: IRows[]) {
  return (
    entries
      .filter((entry) => entry.type === "table" && entry.sql)
      .map((entry) => entry.sql.trim())
      .join(";\n\n") + ";"
  );
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

async function generateSQL(conversation: ConversationManager, naturalQuery: string): Promise<string> {
  const basePrompt = `You are an assistant that converts natural language to SQL queries.
Use this database schema:

${schemaDescription}

Convert the following user query into an SQLite SQL statement:

"${naturalQuery}"


Note: Always use LIKE operator for string matching.
Only respond with the SQL and do not wrap it in markdown, output just plain text. Do not explain.`;

  const contextualPrompt = conversation.getContextualPrompt(basePrompt);
  return await askGemini(contextualPrompt);
}

async function describeResults(
  conversation: ConversationManager,
  naturalQuery: string,
  rows: any[]
): Promise<string> {
  const dataSample = JSON.stringify(rows.slice(0, 3), null, 2);
  const basePrompt = `User asked: "${naturalQuery}".
Here are the query results:\n${dataSample}\n
Summarize the results in simple language.`;

  const contextualPrompt = conversation.getContextualPrompt(basePrompt);
  return await askGemini(contextualPrompt);
}

function removeMarkdownCodeBlock(str: string) {
  return str
    .replace(/```(?:[\w]*)?\n?/g, "")
    .replace(/\n?```$/, "")
    .trim();
}

async function main() {
  const conversation = new ConversationManager(5);
  
  while (true) {
    const question = readline.question(
      '\nAsk your question (or type "exit" to quit, "clear" to reset conversation): '
    );
    
    if (question.toLowerCase() === "exit") break;
    if (question.toLowerCase() === "clear") {
      conversation.clear();
      console.log("\n🔄 Conversation history cleared");
      continue;
    }

    try {
      conversation.addMessage('user', question);
      
      const sql = await generateSQL(conversation, question);
      const cleanedSql = removeMarkdownCodeBlock(sql);
      console.log(`\n🔍 SQL Generated:\n${cleanedSql}`);
      
      const stmt = db.prepare(cleanedSql);
      const rows = stmt.all();

      conversation.updateContext({
        previousQuery: question,
        previousSQL: cleanedSql,
        previousResults: rows
      });

      const summary = await describeResults(conversation, question, rows);
      console.log(`\n📝 Explanation:\n${summary}`);
      
      conversation.addMessage('assistant', `SQL: ${cleanedSql}\nExplanation: ${summary}`);
    } catch (err: any) {
      console.error("\n❌ Error:", err.message);
    }
  }
}

main();
