// import express from "express";
// import TaskBoard from "../Models/TaskModel.js";
// import { verifyToken } from "../Middlewares/AuthMiddleware.js";

// const router = express.Router();

// // GET: Fetch the user's Kanban board
// router.get("/tasks", verifyToken, async (req, res) => {
//   try {
//     let board = await TaskBoard.findOne({ userId: req.user.id });

//     // If the user doesn't have a board yet, send back a default template
//     if (!board) {
//       const defaultColumns = [
//         { id: "col-1", title: "To Do", cards: [] },
//         { id: "col-2", title: "In Progress", cards: [] },
//         { id: "col-3", title: "Done", cards: [] }
//       ];
//       return res.status(200).json({ success: true, columns: defaultColumns });
//     }

//     res.status(200).json({ success: true, columns: board.columns });
//   } catch (error) {
//     console.error("Error fetching tasks:", error);
//     res.status(500).json({ success: false, message: "Server Error" });
//   }
// });

// // POST: Save the entire Kanban board state
// router.post("/tasks", verifyToken, async (req, res) => {
//   try {
//     const { columns } = req.body;

//     if (!Array.isArray(columns)) {
//       return res.status(400).json({ success: false, message: "Invalid data format" });
//     }

//     // Upsert: Update if exists, create if it doesn't
//     const board = await TaskBoard.findOneAndUpdate(
//       { userId: req.user.id },
//       { $set: { columns } },
//       { new: true, upsert: true }
//     );

//     res.status(200).json({ success: true, columns: board.columns });
//   } catch (error) {
//     console.error("Error saving tasks:", error);
//     res.status(500).json({ success: false, message: "Server Error" });
//   }
// });

// export default router;








import express from "express";
import TaskBoard from "../Models/TaskModel.js";
import { verifyToken } from "../Middlewares/AuthMiddleware.js";

const router = express.Router();

// Generate a random ID for default columns
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

const DEFAULT_COLUMNS = [
  { id: uid(), title: "Backlog", items: [] },
  { id: uid(), title: "To Do", items: [] },
  { id: uid(), title: "In Progress", items: [] },
  { id: uid(), title: "Done", items: [] },
];

// GET: Fetch the user's Kanban board
router.get("/tasks", verifyToken, async (req, res) => {
  try {
    const board = await TaskBoard.findOne({ userId: req.user.id });
    
    if (!board) {
      return res.status(200).json({ success: true, columns: DEFAULT_COLUMNS });
    }

    res.status(200).json({ success: true, columns: board.columns });
  } catch (error) {
    console.error("Error fetching tasks:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
});

// POST: Save the entire Kanban board state
router.post("/tasks", verifyToken, async (req, res) => {
  try {
    const { columns } = req.body;

    if (!Array.isArray(columns)) {
      return res.status(400).json({ success: false, message: "Invalid data format" });
    }

    const board = await TaskBoard.findOneAndUpdate(
      { userId: req.user.id },
      { $set: { columns } },
      { new: true, upsert: true }
    );

    res.status(200).json({ success: true, columns: board.columns });
  } catch (error) {
    console.error("Error saving tasks:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
});

export default router;