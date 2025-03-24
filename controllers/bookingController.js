const mongoose = require("mongoose");
const Booking = require("../models/booking");
const Train = require("../models/train");
const User = require("../models/user");

/**
 * @desc    Create a new booking
 * @route   POST /api/v1/bookings
 * @access  Private (User must be authenticated)
 */

exports.createBooking = async (req, res) => {
  try {
    const { trainId, classType, coach, seats, passengers, contact } = req.body;
    const emailRegex = /^\S+@\S+\.\S+$/;
    const ninRegex = /^\d{11}$/;

    // Validate each passenger's email and NIN
    for (let passenger of passengers) {
      if (!emailRegex.test(passenger.email)) {
        return res.status(400).json({
          message: `Invalid email for passenger: ${passenger.email}`,
        });
      }
      if (!ninRegex.test(passenger.nin)) {
        return res.status(400).json({
          message: `NIN must be exactly 11 digits for passenger: ${passenger.name}`,
        });
      }
    }

    // Validate contact email
    if (!emailRegex.test(contact.email)) {
      return res.status(400).json({
        message: "Invalid email format in contact details",
      });
    }

    // Check if the user already has a booking for the same train, class, and coach
    const existingUserBooking = await Booking.findOne({
      user: req.user.id,
      train: trainId,
      classType: classType,
      coach: coach,
      status: { $ne: "cancelled" },
    });
    if (existingUserBooking) {
      return res.status(400).json({
        message: "You already have a booking for this train class and coach",
      });
    }

    // Find the train
    const train = await Train.findById(trainId);
    if (!train) {
      return res.status(404).json({ message: "Train not found" });
    }

    // Find the specific class configuration in the train
    const trainClass = train.classes.find((c) => c.type === classType);
    if (!trainClass) {
      return res.status(404).json({ message: "Class not available" });
    }

    // Validate that requested seat numbers are within the valid range
    const maxSeatNumber = trainClass.totalSeats;
    const invalidSeats = seats.filter(
      (seat) => seat < 1 || seat > maxSeatNumber
    );
    if (invalidSeats.length > 0) {
      return res.status(400).json({
        message: `Invalid seat numbers: ${invalidSeats.join(
          ", "
        )}. Valid seats are 1-${maxSeatNumber}`,
      });
    }

    // Check for seat conflicts specific to this train, class, and coach
    const existingBookings = await Booking.find({
      train: trainId,
      classType: classType,
      coach: coach,
      status: { $ne: "cancelled" },
    });

    let takenSeats = [];
    existingBookings.forEach((booking) => {
      takenSeats = takenSeats.concat(booking.seats);
    });

    const conflictSeats = seats.filter((seat) => takenSeats.includes(seat));
    if (conflictSeats.length > 0) {
      return res.status(400).json({
        message: `The following seat(s) are already taken: ${conflictSeats.join(
          ", "
        )}`,
      });
    }

    // Check if enough seats are available (using the virtual availableSeats)
    if (seats.length > trainClass.availableSeats) {
      return res.status(400).json({
        message: `Only ${trainClass.availableSeats} seats available in ${classType}`,
      });
    }

    // Calculate total price including convenience fee
    let totalPrice = 0;
    for (let i = 0; i < seats.length; i++) {
      const passengerType = passengers[i].type;
      const price =
        passengerType === "Adult"
          ? parseInt(trainClass.priceAdult.replace(/₦/, ""))
          : parseInt(trainClass.priceChild.replace(/₦/, ""));
      totalPrice += price;
    }
    totalPrice += 400; // Convenience fee

    // Create new booking with status "pending"
    const newBooking = new Booking({
      user: req.user.id,
      train: trainId,
      classType,
      coach,
      seats,
      passengers,
      contact,
      totalPrice,
      status: "pending",
    });

    // Use a transaction to ensure atomicity
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      await newBooking.save({ session });

      // Find the index of the class in the train's classes array
      const classIndex = train.classes.findIndex((c) => c.type === classType);
      if (classIndex === -1) {
        await session.abortTransaction();
        session.endSession();
        return res.status(404).json({ message: "Class not found" });
      }

      // Log the seats being added
      console.log(`Adding seats ${seats} to ${classType}`);

      // Update both reservedSeats count and reservedSeatNumbers array
      train.classes[classIndex].reservedSeats += seats.length;
      train.classes[classIndex].reservedSeatNumbers = [
        ...train.classes[classIndex].reservedSeatNumbers,
        ...seats,
      ];

      // Log the updated seats
      console.log(
        `Updated reserved seats:`,
        train.classes[classIndex].reservedSeatNumbers
      );

      await train.save({ session });

      await session.commitTransaction();
      session.endSession();

      return res.status(201).json({
        message: "Booking created successfully",
        booking: newBooking,
      });
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      return res.status(500).json({
        message: "Server error",
        error: error.message,
      });
    }
  } catch (error) {
    return res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};

/**
 * @desc    Get booking by ID
 * @route   GET /api/v1/bookings/:id
 * @access  Private (User must be authenticated)
 */
exports.getBookingById = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate("train")
      .populate("user");

    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    res.json(booking);
  } catch (error) {
    console.error("Error fetching booking:", error);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * @desc    Get all confirmed bookings for a user
 * @route   GET /api/v1/bookings/confirmed
 * @access  Private (User must be authenticated)
 */
exports.getUserConfirmedBookings = async (req, res) => {
  try {
    const userId = req.user.id;

    // Validate user ID format
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid user ID format" });
    }

    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const bookings = await Booking.find({
      user: userId,
      status: "confirmed",
    })
      .populate("train")
      .populate("user");

    res.json(bookings);
  } catch (error) {
    console.error("Error fetching confirmed bookings:", error.stack);
    if (error instanceof mongoose.CastError) {
      return res.status(400).json({ message: "Invalid ID format" });
    }
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

/**
 * @desc    Get all bookings for a user
 * @route   GET /api/v1/bookings
 * @access  Private (User must be authenticated)
 */
exports.getAllUserBookings = async (req, res) => {
  try {
    const userId = req.user.id;

    // Validate user ID format
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid user ID format" });
    }

    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const bookings = await Booking.find({
      user: userId,
    })
      .populate("train")
      .populate("user");

    res.json(bookings);
  } catch (error) {
    console.error("Error fetching all bookings:", error.stack);
    if (error instanceof mongoose.CastError) {
      return res.status(400).json({ message: "Invalid ID format" });
    }
    res.status(500).json({ message: "Server error", error: error.message });
  }
};
