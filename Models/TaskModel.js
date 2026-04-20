// import mongoose from "mongoose";

// const CardSchema = new mongoose.Schema({
//   id: { type: String, required: true }, // We use a custom string ID for perfect drag-and-drop compatibility
//   title: { type: String, required: true },
//   description: { type: String, default: "" },
//   priority: { type: String, enum: ["High", "Medium", "Low", "None"], default: "None" },
//   deadline: { type: String, default: "" }
// }, { _id: false }); // Disable Mongoose's default _id for subdocuments to avoid DND conflicts

// const ColumnSchema = new mongoose.Schema({
//   id: { type: String, required: true },
//   title: { type: String, required: true },
//   cards: [CardSchema]
// }, { _id: false });

// const TaskBoardSchema = new mongoose.Schema({
//   userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
//   columns: [ColumnSchema]
// }, { timestamps: true });

// export default mongoose.model("TaskBoard", TaskBoardSchema);





import mongoose from "mongoose";

const LinkSchema = new mongoose.Schema({
  id: { type: String, required: true },
  title: { type: String, default: "" },
  url: { type: String, default: "" },
}, { _id: false });

const CommentSchema = new mongoose.Schema({
  id: { type: String, required: true },
  text: { type: String, required: true },
  timestamp: { type: String, default: () => new Date().toISOString() },
}, { _id: false });

const CardSchema = new mongoose.Schema({
  id: { type: String, required: true }, // Pure string ID for perfect drag-and-drop
  title: { type: String, required: true },
  description: { type: String, default: "" },
  notes: { type: String, default: "" },
  priority: { type: String, enum: ["High", "Medium", "Low", "None"], default: "None" },
  deadline: { type: String, default: "" },
  tags: [{ type: String }],
  links: [LinkSchema],
  comments: [CommentSchema],
  completed: { type: Boolean, default: false },
}, { _id: false });

const ColumnSchema = new mongoose.Schema({
  id: { type: String, required: true },
  title: { type: String, required: true },
  items: [CardSchema] // Standardized to "items"
}, { _id: false });

const TaskBoardSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
  columns: [ColumnSchema]
}, { timestamps: true });

export default mongoose.model("TaskBoard", TaskBoardSchema);