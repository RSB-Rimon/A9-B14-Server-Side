
import "dotenv/config";
import { MongoClient } from "mongodb";

const mongoUri = process.env.MONGODB_URI;
const adminEmail = process.env.ADMIN_EMAIL;

if (!mongoUri || !adminEmail) {
  throw new Error("MONGODB_URI or ADMIN_EMAIL is missing from .env");
}

const client = new MongoClient(mongoUri);

try {
  await client.connect();

  const db = client.db("salonbookDB");
  const usersCollection = db.collection("user");

  const result = await usersCollection.updateOne(
    { email: adminEmail },
    {
      $set: {
        role: "admin",
      },
    }
  );

  if (result.matchedCount === 0) {
    console.log("User not found. Check ADMIN_EMAIL.");
  } else {
    console.log("Admin role assigned successfully!");
  }
} catch (error) {
  console.error("Failed to promote admin:", error.message);
  process.exitCode = 1;
} finally {
  await client.close();
}
