const Train = require("../models/train");

// Helper functions for date manipulation
// const startOfDay = (dateString) => {
//   const date = new Date(dateString);
//   return new Date(date.getFullYear(), date.getMonth(), date.getDate());
// };

// const endOfDay = (dateString) => {
//   const date = new Date(dateString);
//   return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
// };

/**
 * @desc Get all trains
 * @route GET /api/v1/trains
 * @access Public
 */
exports.getAllTrains = async (req, res) => {
  try {
    const trains = await Train.find().populate("classes");
    res.status(200).json(trains);
  } catch (error) {
    console.error("Error fetching trains:", error);
    res.status(500).json({ message: "Server error", error });
  }
};

/**
 * @desc Get a single train by ID
 * @route GET /api/v1/trains/:id
 * @access Public
 */
exports.getTrainById = async (req, res) => {
  try {
    const train = await Train.findById(req.params.id);
    if (!train) {
      return res.status(404).json({ message: "Train not found" });
    }
    res.status(200).json(train);
  } catch (error) {
    console.error("Error fetching train:", error);
    res.status(500).json({ message: "Server error", error });
  }
};

/**
 * @desc Create a new train
 * @route POST /api/v1/trains
 * @access Private (Admin)
 */
exports.createTrain = async (req, res) => {
  try {
    const newTrain = new Train(req.body);
    await newTrain.save();
    res.status(201).json(newTrain);
  } catch (error) {
    console.error("Error creating train:", error);
    res.status(500).json({ message: "Server error", error });
  }
};

/**
 * @desc Update a train
 * @route PUT /api/v1/trains/:id
 * @access Private
 */
exports.updateTrain = async (req, res) => {
  try {
    const updatedTrain = await Train.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    if (!updatedTrain) {
      return res.status(404).json({ message: "Train not found" });
    }
    res.status(200).json(updatedTrain);
  } catch (error) {
    console.error("Error updating train:", error);
    res.status(500).json({ message: "Server error", error });
  }
};

/**
 * @desc Delete a train
 * @route DELETE /api/v1/trains/:id
 * @access Private
 */
exports.deleteTrain = async (req, res) => {
  try {
    const deletedTrain = await Train.findByIdAndDelete(req.params.id);
    if (!deletedTrain) {
      return res.status(404).json({ message: "Train not found" });
    }
    res.status(200).json({ message: "Train deleted successfully" });
  } catch (error) {
    console.error("Error deleting train:", error);
    res.status(500).json({ message: "Server error", error });
  }
};

/**
 * @desc Search trains by departure, arrival, and date
 * @route POST /api/v1/trains/search
 * @access Public
 */
exports.searchTrains = async (req, res) => {
  try {
    const { fromStation, toStation, date } = req.body;
    if (!fromStation || !toStation || !date) {
      return res
        .status(400)
        .json({ message: "Please provide fromStation, toStation, and date." });
    }

    // Convert the input date string to a Date object
    const searchDate = new Date(date);

    // Create start and end of day Date objects
    const start = new Date(searchDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(searchDate);
    end.setHours(23, 59, 59, 999);

    // Add logging to check the values
    // console.log("Search parameters:", { fromStation, toStation, date });
    // console.log("Converted searchDate:", searchDate);
    // console.log("Query start time:", start);
    // console.log("Query end time:", end);

    // Find trains that match the criteria
    const trains = await Train.find({
      "departure.station": fromStation,
      "arrival.station": toStation,
      "departure.date": {
        $gte: start,
        $lte: end,
      },
    });

    // Add logging to see what trains were found
    console.log("Trains found in database:", trains);

    // Check for available seats
    const availableTrains = trains.filter((train) =>
      train.classes.some((cls) => cls.availableSeats > 0)
    );

    // Add logging to see the available trains
    console.log("Available trains after filtering:", availableTrains);

    // Return 200 status with empty array if no trains are available
    if (!availableTrains.length) {
      return res.status(200).json([]);
    }

    res.status(200).json(availableTrains);
  } catch (error) {
    console.error("Error searching trains:", error);
    res.status(500).json({ message: "Server error", error });
  }
};

/**
 * @desc Get available train dates
 * @route GET /api/v1/trains/available-dates
 * @access Public
 */
exports.getAvailableDates = async (req, res) => {
  try {
    const { fromStation, toStation } = req.query;

    let query = Train.find();
    if (fromStation && toStation) {
      query = query.and([
        { "departure.station": fromStation },
        { "arrival.station": toStation },
      ]);
    }

    const trains = await query;
    const availableDates = new Set();

    trains.forEach((train) => {
      if (train.classes.some((cls) => cls.availableSeats > 0)) {
        availableDates.add(train.departure.date.toISOString().split("T")[0]);
      }
    });

    res.status(200).json(Array.from(availableDates));
  } catch (error) {
    console.error("Error fetching available dates:", error);
    res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};
