import fs from "fs";
import { Database } from "bun:sqlite";

const db = new Database("hospital.db");

const seedSQL = fs.readFileSync("seed.sql", "utf8");
db.exec(seedSQL);

console.log("✅ Database seeded.");
