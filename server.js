
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
  })
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

// Make database available to middleware
app.locals.db = db;

// Health Check
app.get("/", (req, res) => {
  res.send("SalonBook API is running.");
});

// ADMIN AUTHENTICATION TEST
app.get("/admin/test", verifyToken, verifyAdmin, (req, res) => {
  res.status(200).json({
    success: true,
    message: "Admin authentication successful!",
  });
});

// GET ALL ACTIVE SERVICES
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

// GET SINGLE ACTIVE SERVICE
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

// ADMIN: GET ALL SERVICES (ACTIVE + INACTIVE)
app.get("/admin/services", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const services = await servicesCollection
      .find({})
      .sort({ createdAt: -1 })
      .toArray();

    res.status(200).json({
      success: true,
      count: services.length,
      data: services,
    });
  } catch (error) {
    console.error("Admin get services error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch services.",
    });
  }
});

// ADMIN: CREATE SERVICE
app.post("/admin/services", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const {
      serviceName,
      category,
      description,
      price,
      duration,
      image,
      status = "active",
    } = req.body;

    const numericPrice = Number(price);
    const numericDuration = Number(duration);

    if (
      typeof serviceName !== "string" ||
      !serviceName.trim() ||
      typeof category !== "string" ||
      !category.trim() ||
      typeof description !== "string" ||
      !description.trim() ||
      typeof image !== "string" ||
      !image.trim() ||
      !Number.isFinite(numericPrice) ||
      numericPrice <= 0 ||
      !Number.isFinite(numericDuration) ||
      numericDuration <= 0 ||
      !["active", "inactive"].includes(status)
    ) {
      return res.status(400).json({
        success: false,
        message: "Please provide valid service information.",
      });
    }

    const newService = {
      serviceName: serviceName.trim(),
      category: category.trim(),
      description: description.trim(),
      price: numericPrice,
      duration: numericDuration,
      image: image.trim(),
      status,
      createdAt: new Date(),
    };

    const result = await servicesCollection.insertOne(newService);

    res.status(201).json({
      success: true,
      message: "Service created successfully.",
      data: {
        _id: result.insertedId,
        ...newService,
      },
    });
  } catch (error) {
    console.error("Create service error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to create service.",
    });
  }
});

// ADMIN: UPDATE SERVICE
app.patch("/admin/services/:id", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid service ID.",
      });
    }

    const allowedFields = [
      "serviceName",
      "category",
      "description",
      "price",
      "duration",
      "image",
      "status",
    ];

    const updates = {};

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid fields provided.",
      });
    }

    for (const field of ["serviceName", "category", "description", "image"]) {
      if (
        updates[field] !== undefined &&
        (typeof updates[field] !== "string" || !updates[field].trim())
      ) {
        return res.status(400).json({
          success: false,
          message: `Invalid ${field}.`,
        });
      }

      if (updates[field] !== undefined) {
        updates[field] = updates[field].trim();
      }
    }

    if (updates.price !== undefined) {
      updates.price = Number(updates.price);

      if (!Number.isFinite(updates.price) || updates.price <= 0) {
        return res.status(400).json({
          success: false,
          message: "Price must be a positive number.",
        });
      }
    }

    if (updates.duration !== undefined) {
      updates.duration = Number(updates.duration);

      if (!Number.isFinite(updates.duration) || updates.duration <= 0) {
        return res.status(400).json({
          success: false,
          message: "Duration must be a positive number.",
        });
      }
    }

    if (
      updates.status !== undefined &&
      !["active", "inactive"].includes(updates.status)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid service status.",
      });
    }

    const result = await servicesCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: updates }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Service not found.",
      });
    }

    res.status(200).json({
      success: true,
      message: "Service updated successfully.",
    });
  } catch (error) {
    console.error("Update service error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to update service.",
    });
  }
});

// ADMIN: DELETE SERVICE
app.delete("/admin/services/:id", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid service ID.",
      });
    }

    const result = await servicesCollection.deleteOne({
      _id: new ObjectId(id),
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Service not found.",
      });
    }

    res.status(200).json({
      success: true,
      message: "Service deleted successfully.",
    });
  } catch (error) {
    console.error("Delete service error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to delete service.",
    });
  }
});

// NOT FOUND
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "API route not found.",
  });
});

app.listen(port, () => {
  console.log(`SalonBook API running on port ${port}`);
});
