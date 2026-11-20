import express from "express";
import cors from "cors";
import "dotenv/config";
import { MongoClient, ObjectId } from "mongodb";
import { verifyToken, verifyAdmin } from "./middleware/auth.js";

const app = express();
const port = Number(process.env.PORT) || 5000;
const clientUrl = process.env.CLIENT_URL || "http://localhost:3000";
const mongoUri = process.env.MONGODB_URI;

if (!mongoUri) {
  throw new Error("MONGODB_URI is missing from the environment.");
}

app.use(express.json());

app.use(
  cors({
    origin: clientUrl,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

const mongoClient = new MongoClient(mongoUri);

try {
  await mongoClient.connect();
  console.log("Connected to MongoDB.");
} catch (error) {
  console.error("MongoDB connection failed:", error);
  process.exit(1);
}

const db = mongoClient.db("salonbookDB");
const servicesCollection = db.collection("services");

// Health Check
app.get("/", (req, res) => {
  res.send("SalonBook API is running.");
});

// Get Active Services with Search, Filter and Sorting
app.get("/services", async (req, res) => {
  try {
    const { search, category, sort } = req.query;

    const query = {
      status: "active",
    };

    if (search && typeof search === "string") {
      const safeSearch = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

      query.serviceName = {
        $regex: safeSearch,
        $options: "i",
      };
    }

    if (category && typeof category === "string") {
      query.category = category;
    }

    let sortOption = { createdAt: -1 };

    if (sort === "price-asc") {
      sortOption = { price: 1 };
    } else if (sort === "price-desc") {
      sortOption = { price: -1 };
    }

    app.get("/admin/test", verifyToken, verifyAdmin, (req, res) => {
      res.status(200).json({
        success: true,
        message: "Admin authentication successful!",
        user: req.user,
      });
    });

    const services = await servicesCollection
      .find(query)
      .sort(sortOption)
      .toArray();

    res.status(200).json({
      success: true,
      count: services.length,
      data: services,
    });
  } catch (error) {
    console.error("Get services error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch services.",
    });
  }
});

// Get Single Active Service
app.get("/services/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid service ID.",
      });
    }

    const service = await servicesCollection.findOne({
      _id: new ObjectId(id),
      status: "active",
    });

    if (!service) {
      return res.status(404).json({
        success: false,
        message: "Service not found.",
      });
    }

    res.status(200).json({
      success: true,
      data: service,
    });
  } catch (error) {
    console.error("Get service error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch service.",
    });
  }
});

// Not Found
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "API route not found.",
  });
});

app.listen(port, () => {
  console.log(`SalonBook API running on port ${port}`);
});
