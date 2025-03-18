import express from "express";
import bodyParser from "body-parser";
import { userRouter } from "./routes/users";
import { taskRouter } from "./routes/tasks";

const app = express();
const port = process.env.PORT || 5000;

app.use(bodyParser.json());

// Server metrics
let requestCount = 0;
let lastRequestTime: Date | null = null;

app.use((req, res, next) => {
  requestCount++;
  lastRequestTime = new Date();

  req.on("end", () => {
    console.log(`Request ${requestCount} completed`);
  });
  next();
});

app.get("/status", (req, res) => {
  const status = {
    uptime: process.uptime(),
    requestCount,
    lastRequest: lastRequestTime ? lastRequestTime.toISOString() : null,
  };
  res.json(status);
});

app.use("/users", userRouter);
app.use("/task", taskRouter);

app.use(
  (
    err: Error,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    console.error(err.stack);
    res.status(500).send({ error: err.message });
  }
);

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
