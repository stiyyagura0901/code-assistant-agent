import express from "express";

export const taskRouter = express.Router();

// Task interface for type safety
interface Task {
  id: number;
  title: string;
  completed: boolean;
  createdAt: Date;
  updatedAt: Date;
  version: number; // For optimistic locking
}

// In-memory task storage with proper typing
const tasks: Task[] = [];
let taskIdCounter = 0;

// Mutex map for task-level locking
const taskLocks = new Map<number, boolean>();

// Helper function to acquire a lock
const acquireLock = (taskId: number): boolean => {
  if (taskLocks.get(taskId)) {
    return false;
  }
  taskLocks.set(taskId, true);
  return true;
};

// Helper function to release a lock
const releaseLock = (taskId: number): void => {
  taskLocks.delete(taskId);
};

taskRouter.post("/", async (req, res) => {
  try {
    if (!req.body.title || typeof req.body.title !== "string") {
      return res
        .status(400)
        .json({ error: "Title is required and must be a string" });
    }

    const task: Task = {
      id: taskIdCounter++,
      title: req.body.title,
      completed: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      version: 1,
    };

    tasks.push(task);
    res.status(201).json(task);
  } catch (error) {
    res.status(500).json({ error: "Failed to create task" });
  }
});

taskRouter.get("/", (req, res) => {
  try {
    const completed =
      req.query.completed === "true"
        ? true
        : req.query.completed === "false"
        ? false
        : undefined;

    const filteredTasks =
      completed !== undefined
        ? tasks.filter((task) => task.completed === completed)
        : tasks;

    res.json(filteredTasks);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch tasks" });
  }
});

taskRouter.patch("/:id/toggle", async (req, res) => {
  const taskId = parseInt(req.params.id);

  if (isNaN(taskId)) {
    return res.status(400).json({ error: "Invalid task ID" });
  }

  try {
    // Try to acquire lock
    if (!acquireLock(taskId)) {
      return res.status(409).json({
        error: "Task is currently being modified. Please try again.",
      });
    }

    const task = tasks.find((t) => t.id === taskId);

    if (!task) {
      releaseLock(taskId);
      return res.status(404).json({ error: "Task not found" });
    }

    // Version check for optimistic locking
    const clientVersion =
      parseInt(req.headers["if-match"] as string) || task.version;
    if (clientVersion !== task.version) {
      releaseLock(taskId);
      return res.status(409).json({
        error:
          "Task was modified by another request. Please refresh and try again.",
      });
    }

    // Update task with new values
    const updatedTask: Task = {
      ...task,
      completed: !task.completed,
      updatedAt: new Date(),
      version: task.version + 1,
    };

    // Replace the task in the array
    const taskIndex = tasks.findIndex((t) => t.id === taskId);
    tasks[taskIndex] = updatedTask;

    // Release lock and send response
    releaseLock(taskId);
    res.json(updatedTask);
  } catch (error) {
    releaseLock(taskId);
    res.status(500).json({ error: "Failed to update task" });
  }
});

taskRouter.delete("/completed", (req, res) => {
  try {
    const remainingTasks = tasks.filter((task) => !task.completed);
    tasks.length = 0;
    tasks.push(...remainingTasks);
    res.status(200).json({ message: "Completed tasks deleted" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete completed tasks" });
  }
});
