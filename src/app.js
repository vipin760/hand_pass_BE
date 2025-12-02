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
app.use(express.json())
app.use(cors());
//routes
const indexRoutes = require('./routes/index')
const authRoutes = require("./routes/auth.route")
const fileUploadRoutes = require('./routes/fileUpload.route')
const connectDeviceRoutes = require("./routes/device.route");
const groupRoutes = require("./routes/group.route");
const usersRoutes = require("./routes/user.routes");
const { restartDatabase } = require('./crone/deviceOfflineCron');


app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use("/", indexRoutes);
app.use("/api/auth", authRoutes)
app.use("/api/upload",fileUploadRoutes)
app.use("/v1",connectDeviceRoutes)
app.use("/api/group",groupRoutes)
app.use("/api/users",usersRoutes)

// restartDatabase()


//error middleware
app.use(errorMiddleare);

module.exports = app