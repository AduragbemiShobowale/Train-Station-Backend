const mongoose = require("mongoose");

// Define the Class schema
const ClassSchema = new mongoose.Schema({
  type: { type: String, required: true },
  priceAdult: { type: String, required: true },
  priceChild: { type: String, required: true },
  totalSeats: { type: Number, required: true },
  reservedSeats: { type: Number, default: 0 },
  reservedSeatNumbers: { type: [Number], default: [] },
});

// Virtual for available seats
ClassSchema.virtual("availableSeats").get(function () {
  return this.totalSeats - (this.reservedSeatNumbers?.length || 0);
});

// Ensure virtuals are included when converting to JSON or Object
ClassSchema.set("toJSON", { virtuals: true });
ClassSchema.set("toObject", { virtuals: true });

// Define the Train schema
const TrainSchema = new mongoose.Schema({
  departure: {
    station: { type: String, required: true },
    street: { type: String },
    year: { type: String },
    time: { type: String, required: true },
    date: { type: Date, required: true },
  },
  arrival: {
    station: { type: String, required: true },
    street: { type: String },
    year: { type: String },
    time: { type: String, required: true },
    date: { type: Date, required: true },
  },
  trainNumber: { type: String, required: true, unique: true },
  route: { type: String, required: true },
  timeOfDay: { type: String, required: true },
  duration: { type: String, required: true },
  classes: [ClassSchema],
});

// Ensure virtuals are included for Train documents as well
TrainSchema.set("toJSON", { virtuals: true });
TrainSchema.set("toObject", { virtuals: true });
TrainSchema.index({
  "departure.station": 1,
  "arrival.station": 1,
  "departure.date": 1,
});

module.exports = mongoose.model("Train", TrainSchema);
