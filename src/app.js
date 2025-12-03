const express = require('express')
const cors = require('cors')
const errorMiddleare = require('./middleware/error')
const path = require('path')
const morgan = require('morgan');
const app = express()

app.use('/uploads', express.static(path.join(__dirname,'..', 'uploads')));
// Set EJS as template engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(morgan('dev'));
//routes
const indexRoutes = require('./routes/index')
const authRoutes = require("./routes/auth.route")
const fileUploadRoutes = require('./routes/fileUpload.route')
const connectDeviceRoutes = require("./routes/device.route");
const groupRoutes = require("./routes/group.route");
const usersRoutes = require("./routes/user.routes");
const { restartDatabase } = require('./crone/deviceOfflineCron');

app.use(express.json({ limit: "200mb" }));  
app.use(express.urlencoded({ limit: "200mb", extended: true }));
app.use(cors());

app.use("/", indexRoutes);
app.use("/v1",connectDeviceRoutes)
app.use("/api/auth", authRoutes)
app.use("/api/upload",fileUploadRoutes)
app.use("/api/group",groupRoutes)
app.use("/api/users",usersRoutes)

// restartDatabase()


app.use((err, req, res, next) => {
  console.error("🔥 ERROR CAUGHT BY MIDDLEWARE 🔥");
  console.error("Message:", err.message);
  console.error("Stack:", err.stack);
  console.error("REQ BODY:", req.body);
  return res.status(500).json({
    code: 500,
    msg: "Internal Server Error",
    error: err.message,
  });
});
//error middleware
app.use(errorMiddleare);

module.exports = app