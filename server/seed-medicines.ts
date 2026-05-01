import { db } from "./db";
import { medicineReference } from "@shared/schema";
import { sql } from "drizzle-orm";
import * as fs from "fs";
import * as path from "path";

async function seedMedicines() {
  const csvPath = path.join(process.cwd(), "attached_assets", "medicine_dataset_1770797051330.csv");
  
  if (!fs.existsSync(csvPath)) {
    console.error("CSV file not found:", csvPath);
    process.exit(1);
  }

  const existing = await db.select({ count: sql<number>`count(*)` }).from(medicineReference);
  const currentCount = Number(existing[0].count);
  
  if (currentCount > 0) {
    console.log(`Medicine reference table already has ${currentCount} records. Skipping seed.`);
    return;
  }

  console.log("Reading CSV file...");
  const csvContent = fs.readFileSync(csvPath, "utf-8");
  const lines = csvContent.split("\n").filter(line => line.trim().length > 0);
  const header = lines[0];
  const dataLines = lines.slice(1);

  console.log(`Found ${dataLines.length} medicine records to seed.`);

  const BATCH_SIZE = 1000;
  let inserted = 0;

  for (let i = 0; i < dataLines.length; i += BATCH_SIZE) {
    const batch = dataLines.slice(i, i + BATCH_SIZE);
    const values = batch.map(line => {
      const parts = line.split(",");
      return {
        name: parts[0]?.trim() || "",
        category: parts[1]?.trim() || null,
        dosageForm: parts[2]?.trim() || null,
        strength: parts[3]?.trim() || null,
        indication: parts[4]?.trim() || null,
      };
    }).filter(v => v.name.length > 0);

    if (values.length > 0) {
      await db.insert(medicineReference).values(values);
      inserted += values.length;
      if (inserted % 5000 === 0 || inserted === dataLines.length) {
        console.log(`  Inserted ${inserted} / ${dataLines.length} records...`);
      }
    }
  }

  console.log(`Seed complete. Total records inserted: ${inserted}`);
}

seedMedicines()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  });
