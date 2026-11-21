
  import express from "express";
  import cors from "cors";
  import "dotenv/config";
  import { MongoClient, ObjectId } from "mongodb";
  import { verifyToken, verifyAdmin } from "./middleware/auth.js";
  import uploadRoutes from "./routes/upload.routes.js";

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
  app.use("/admin", uploadRoutes);
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
  const usersCollection = db.collection("user");
const appointmentsCollection = db.collection("appointments");
const transactionsCollection = db.collection("transactions");

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
  app.get("/test-services", async (req, res) => {
  try {
    const services = await servicesCollection.find({}).toArray();

    res.json({
      count: services.length,
      data: services.map((service) => ({
        name: service.serviceName,
        status: service.status,
        category: service.category,
      })),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
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


 // ADMIN: DASHBOARD OVERVIEW
app.get(
  "/admin/dashboard/stats",
  verifyToken,
  verifyAdmin,
  async (req, res) => {
    try {
      const [
        totalCustomers,
        activeServices,
        totalAppointments,
        pendingAppointments,
        confirmedAppointments,
        successfulPayments,
        recentAppointments,
      ] = await Promise.all([
        usersCollection.countDocuments({ role: "customer" }),

        servicesCollection.countDocuments({ status: "active" }),

        appointmentsCollection.countDocuments({}),

        appointmentsCollection.countDocuments({ status: "pending" }),

        appointmentsCollection.countDocuments({ status: "confirmed" }),

        transactionsCollection.countDocuments({ status: "paid" }),

        appointmentsCollection
          .find({})
          .sort({ createdAt: -1 })
          .limit(5)
          .toArray(),
      ]);

      const paymentResult = await transactionsCollection
        .aggregate([
          { $match: { status: "paid" } },
          {
            $group: {
              _id: null,
              totalAmount: {
                $sum: {
                  $convert: {
                    input: "$amount",
                    to: "double",
                    onError: 0,
                    onNull: 0,
                  },
                },
              },
            },
          },
        ])
        .toArray();

      const successfulPaymentAmount =
        paymentResult[0]?.totalAmount || 0;

      const formattedAppointments = await Promise.all(
        recentAppointments.map(async (appointment) => {
          const serviceId = appointment.serviceId;
          const customerId =
            appointment.customerId || appointment.userId;

          let service = null;
          let customer = null;

          if (serviceId && ObjectId.isValid(String(serviceId))) {
            service = await servicesCollection.findOne({
              _id: new ObjectId(String(serviceId)),
            });
          }

          if (customerId) {
            const customerFilters = [
              { id: String(customerId) },
              { _id: String(customerId) },
            ];

            if (ObjectId.isValid(String(customerId))) {
              customerFilters.push({
                _id: new ObjectId(String(customerId)),
              });
            }

            customer = await usersCollection.findOne({
              $or: customerFilters,
            });
          }

          return {
            _id: appointment._id,
            customerName: customer?.name || "Unknown Customer",
            customerEmail: customer?.email || "",
            serviceName: service?.serviceName || "Unknown Service",
            appointmentDate: appointment.appointmentDate || null,
            timeSlot: appointment.timeSlot || "",
            servicePrice: appointment.servicePrice || 0,
            status: appointment.status || "pending",
            createdAt: appointment.createdAt || null,
          };
        })
      );

      res.status(200).json({
        success: true,
        data: {
          stats: {
            totalCustomers,
            activeServices,
            totalAppointments,
            pendingAppointments,
            confirmedAppointments,
            successfulPayments,
            successfulPaymentAmount,
          },
          recentAppointments: formattedAppointments,
        },
      });
    } catch (error) {
      console.error("Admin dashboard stats error:", error);

      res.status(500).json({
        success: false,
        message: "Failed to fetch dashboard statistics.",
      });
    }
  }
);


// add more 
// ===============================
// ADMIN: GET ALL APPOINTMENTS
// ===============================
app.get("/admin/appointments", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { status } = req.query;
    const query = {};

    if (status && ["pending", "confirmed", "cancelled"].includes(status)) {
      query.status = status;
    }

    const appointments = await appointmentsCollection
      .find(query)
      .sort({ createdAt: -1 })
      .toArray();

    res.status(200).json({
      success: true,
      count: appointments.length,
      data: appointments,
    });
  } catch (error) {
    console.error("Get appointments error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch appointments",
    });
  }
});

// ===============================
// ADMIN: GET APPOINTMENT DETAILS
// ===============================
app.get("/admin/appointments/:id", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid appointment ID",
      });
    }

    const appointment = await appointmentsCollection.findOne({
      _id: new ObjectId(id),
    });

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: "Appointment not found",
      });
    }

    res.status(200).json({
      success: true,
      data: appointment,
    });
  } catch (error) {
    console.error("Appointment details error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch appointment details",
    });
  }
});

// ===============================
// ADMIN: UPDATE APPOINTMENT STATUS
// ===============================
app.patch("/admin/appointments/:id/status", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid appointment ID",
      });
    }

    if (!["confirmed", "cancelled"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Status must be confirmed or cancelled",
      });
    }

    const appointment = await appointmentsCollection.findOne({
      _id: new ObjectId(id),
    });

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: "Appointment not found",
      });
    }

    if (status === "confirmed" && appointment.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: "Only pending appointments can be confirmed",
      });
    }

    if (
      status === "cancelled" &&
      !["pending", "confirmed"].includes(appointment.status)
    ) {
      return res.status(400).json({
        success: false,
        message: "This appointment cannot be cancelled",
      });
    }

    await appointmentsCollection.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          status,
          updatedAt: new Date(),
        },
      }
    );

    res.status(200).json({
      success: true,
      message: `Appointment ${status} successfully`,
    });
  } catch (error) {
    console.error("Update appointment status error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update appointment status",
    });
  }
});

// ADMIN: GET ALL CUSTOMERS
app.get("/admin/users", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { search, status } = req.query;

    const query = { role: "customer" };

    if (search && typeof search === "string") {
      const safeSearch = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

      query.$or = [
        { name: { $regex: safeSearch, $options: "i" } },
        { email: { $regex: safeSearch, $options: "i" } },
      ];
    }

    if (status === "blocked") {
      query.isBlocked = true;
    } else if (status === "active") {
      query.isBlocked = { $ne: true };
    }

    const users = await usersCollection
      .find(query)
      .project({
        name: 1,
        email: 1,
        image: 1,
        createdAt: 1,
        isBlocked: 1,
      })
      .sort({ createdAt: -1 })
      .toArray();

    res.status(200).json({
      success: true,
      count: users.length,
      data: users,
    });
  } catch (error) {
    console.error("Get admin users error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch customers.",
    });
  }
});


// ADMIN: BLOCK / UNBLOCK CUSTOMER
app.patch(
  "/admin/users/:id/status",
  verifyToken,
  verifyAdmin,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { isBlocked } = req.body;

      if (typeof isBlocked !== "boolean") {
        return res.status(400).json({
          success: false,
          message: "isBlocked must be true or false.",
        });
      }

      const userFilters = [
        { id: String(id) },
        { _id: String(id) },
      ];

      if (ObjectId.isValid(id)) {
        userFilters.push({ _id: new ObjectId(id) });
      }

      const result = await usersCollection.updateOne(
        {
          role: "customer",
          $or: userFilters,
        },
        {
          $set: { isBlocked },
        }
      );

      if (result.matchedCount === 0) {
        return res.status(404).json({
          success: false,
          message: "Customer not found.",
        });
      }

      res.status(200).json({
        success: true,
        message: isBlocked
          ? "Customer blocked successfully."
          : "Customer unblocked successfully.",
      });
    } catch (error) {
      console.error("Update customer status error:", error);

      res.status(500).json({
        success: false,
        message: "Failed to update customer status.",
      });
    }
  }
);



app.post("/appointments", verifyToken, async (req, res) => {
  try {
    const { serviceId, appointmentDate, timeSlot, message } = req.body;

    if (!serviceId || !appointmentDate || !timeSlot) {
      return res.status(400).json({
        success: false,
        message: "Service, appointment date and time are required.",
      });
    }

    if (!ObjectId.isValid(serviceId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid service ID.",
      });
    }

    const service = await servicesCollection.findOne({
      _id: new ObjectId(serviceId),
      status: "active",
    });

    if (!service) {
      return res.status(404).json({
        success: false,
        message: "Service not found or inactive.",
      });
    }

    const appointment = {
      customerId: req.user.id,
      customerName: req.user.name || "",
      customerEmail: req.user.email,
      serviceId: service._id,
      serviceName: service.serviceName || service.name,
      servicePrice: Number(service.price),
      serviceDuration: Number(service.duration),
      appointmentDate,
      timeSlot,
      message: message || "",
      status: "pending",
      paymentStatus: "unpaid",
      createdAt: new Date(),
    };

    const result = await appointmentsCollection.insertOne(appointment);

    res.status(201).json({
      success: true,
      message: "Appointment request submitted successfully!",
      data: {
        _id: result.insertedId,
        ...appointment,
      },
    });
  } catch (error) {
    console.error("Appointment booking error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to create appointment.",
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
