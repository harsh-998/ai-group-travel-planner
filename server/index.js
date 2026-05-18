require("dotenv").config();

const express = require("express");
const cors = require("cors");

const itineraryRoutes = require("./routes/itinerary");
const connectDB = require("./config/db");
const authRoutes = require("./routes/authRoutes");
const groupRoutes = require("./routes/groupRoutes");
const planningRoutes = require("./src/api/routes/planningRoutes");
const traceRequest = require("./src/api/middleware/traceRequest");
const errorHandler = require("./src/api/middleware/errorHandler");
const requireDatabase = require("./middleware/requireDatabase");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(traceRequest);

connectDB();

app.use("/api/auth", requireDatabase, authRoutes);
app.use("/api/group", requireDatabase, groupRoutes);
app.use("/api/itinerary", requireDatabase, itineraryRoutes);
app.use("/api/planning", requireDatabase, planningRoutes);

app.get("/", (req, res) => {
    res.json({
        status: "ok",
        service: "WayFinder API",
        planningApi: "/api/planning"
    });
});

app.use(errorHandler);

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
