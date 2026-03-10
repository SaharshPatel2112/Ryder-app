const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const app = express();

app.use(cors());
app.use(express.json());

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

app.get("/api/test", (req, res) => {
  res.json({ message: "Ryder Backend is connected!" });
});

app.get("/api/db-check", async (req, res) => {
  const { data, error } = await supabase.from("rides").select("*").limit(1);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ message: "Supabase connection is successful!" });
});

app.post("/api/rides", async (req, res) => {
  const {
    rider_id,
    rider_name,
    rider_image_url,
    pickup_location,
    dropoff_location,
    pickup_lat,
    pickup_lon,
    dropoff_lat,
    dropoff_lon,
    fare,
    distance_km,
    vehicle_type,
  } = req.body;

  if (!rider_id || !pickup_location || !dropoff_location || !fare) {
    return res.status(400).json({ error: "Missing required ride details!" });
  }

  const { data, error } = await supabase
    .from("rides")
    .insert([
      {
        rider_id,
        rider_name,
        rider_image_url,
        pickup_location,
        dropoff_location,
        pickup_lat,
        pickup_lon,
        dropoff_lat,
        dropoff_lon,
        fare,
        distance_km,
        vehicle_type,
        status: "requested",
      },
    ])
    .select();

  if (error) {
    console.error("Database Error:", error);
    return res.status(500).json({ error: "Failed to create ride." });
  }

  res
    .status(201)
    .json({ message: "Ride requested successfully!", ride: data[0] });
});

app.get("/api/rides/requested", async (req, res) => {
  const { data, error } = await supabase
    .from("rides")
    .select("*")
    .eq("status", "requested")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Database Error:", error);
    return res.status(500).json({ error: "Failed to fetch requested rides." });
  }

  res.status(200).json(data);
});

app.put("/api/rides/:id/accept", async (req, res) => {
  const rideId = req.params.id;
  const { driver_id, driver_name, driver_image_url } = req.body;

  if (!driver_id) {
    return res.status(400).json({ error: "Driver ID is required!" });
  }

  const { data, error } = await supabase
    .from("rides")
    .update({
      status: "accepted",
      driver_id: driver_id,
      driver_name: driver_name,
      driver_image_url: driver_image_url,
    })
    .eq("id", rideId)
    .select();

  if (error) {
    console.error("Database Error:", error);
    return res.status(500).json({ error: "Failed to accept ride." });
  }

  res
    .status(200)
    .json({ message: "Ride accepted successfully!", ride: data[0] });
});

app.get("/api/rides/:id", async (req, res) => {
  const { data, error } = await supabase
    .from("rides")
    .select("*")
    .eq("id", req.params.id)
    .single();

  if (error) return res.status(500).json({ error: "Ride not found" });
  res.status(200).json(data);
});

app.put("/api/rides/:id/complete", async (req, res) => {
  const { data, error } = await supabase
    .from("rides")
    .update({ status: "completed" })
    .eq("id", req.params.id)
    .select();

  if (error) return res.status(500).json({ error: "Failed to complete ride." });
  res.status(200).json({ message: "Ride completed!", ride: data[0] });
});

app.get("/api/driver/:id/stats", async (req, res) => {
  const driverId = req.params.id;

  const { data, error } = await supabase
    .from("rides")
    .select("fare, distance_km")
    .eq("driver_id", driverId)
    .eq("status", "completed");

  if (error) return res.status(500).json({ error: "Failed to fetch stats." });

  let totalFare = 0;
  let totalDistance = 0;

  data.forEach((ride) => {
    totalFare += Number(ride.fare || 0);
    totalDistance += Number(ride.distance_km || 0);
  });

  res.status(200).json({
    totalRides: data.length,
    totalFare: totalFare.toFixed(2),
    totalDistance: totalDistance.toFixed(1),
  });
});

app.get("/api/driver/:id/history", async (req, res) => {
  const driverId = req.params.id;
  const { data, error } = await supabase
    .from("rides")
    .select("*")
    .eq("driver_id", driverId)
    .eq("status", "completed")
    .order("created_at", { ascending: false });

  if (error)
    return res.status(500).json({ error: "Failed to fetch driver history." });
  res.status(200).json(data);
});

app.get("/api/rider/:id/history", async (req, res) => {
  const riderId = req.params.id;

  const { data, error } = await supabase
    .from("rides")
    .select("*")
    .eq("rider_id", riderId)
    .order("created_at", { ascending: false });

  if (error) return res.status(500).json({ error: "Failed to fetch history." });
  res.status(200).json(data);
});

app.post("/api/create-payment-intent", async (req, res) => {
  const { fare } = req.body;

  if (!fare) {
    return res
      .status(400)
      .json({ error: "Fare is required to process payment." });
  }

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(fare * 100),
      currency: "inr",
      automatic_payment_methods: { enabled: true },
    });

    res.status(200).json({ clientSecret: paymentIntent.client_secret });
  } catch (error) {
    console.error("Stripe Error:", error);
    res.status(500).json({ error: "Failed to initialize Stripe payment." });
  }
});

app.put("/api/rides/:id/cancel-by-rider", async (req, res) => {
  const { error } = await supabase
    .from("rides")
    .update({ status: "canceled" })
    .eq("id", req.params.id);
  if (error) return res.status(500).json({ error: "Failed to cancel ride." });
  res.status(200).json({ message: "Ride canceled." });
});

app.put("/api/rides/:id/cancel-by-driver", async (req, res) => {
  const { error } = await supabase
    .from("rides")
    .update({ status: "requested", driver_id: null })
    .eq("id", req.params.id);
  if (error) return res.status(500).json({ error: "Failed to cancel ride." });
  res.status(200).json({ message: "Ride dropped." });
});

app.put("/api/rides/:id/pickup", async (req, res) => {
  const { error } = await supabase
    .from("rides")
    .update({ status: "in_transit" })
    .eq("id", req.params.id);
  if (error)
    return res.status(500).json({ error: "Failed to update pickup status." });
  res.status(200).json({ message: "Passenger picked up." });
});

app.put("/api/rides/:id/pay", async (req, res) => {
  const { payment_method } = req.body;
  const { error } = await supabase
    .from("rides")
    .update({ payment_method: payment_method })
    .eq("id", req.params.id);

  if (error)
    return res.status(500).json({ error: "Failed to process payment." });
  res.status(200).json({ message: "Payment successful." });
});

app.put("/api/rides/:id/rate", async (req, res) => {
  const { rating, review } = req.body;
  const { error } = await supabase
    .from("rides")
    .update({ rating: rating, review: review })
    .eq("id", req.params.id);

  if (error) return res.status(500).json({ error: "Failed to submit review." });
  res.status(200).json({ message: "Review saved successfully!" });
});

app.get("/api/driver/:id/profile", async (req, res) => {
  const driverId = req.params.id;

  const { data: ratedRides } = await supabase
    .from("rides")
    .select("rating, review, created_at, rider_name, rider_image_url")
    .eq("driver_id", driverId)
    .not("rating", "is", null);

  const { data: allRides } = await supabase
    .from("rides")
    .select("id, driver_name, driver_image_url")
    .eq("driver_id", driverId)
    .eq("status", "completed");

  const safeRatedRides = ratedRides || [];
  const safeAllRides = allRides || [];

  let avgRating = 5.0;
  if (safeRatedRides.length > 0) {
    const sum = safeRatedRides.reduce((acc, curr) => acc + curr.rating, 0);
    avgRating = (sum / safeRatedRides.length).toFixed(1);
  }

  let dName = "Ryder Driver";
  let dPhoto = `https://api.dicebear.com/7.x/avataaars/svg?seed=${driverId}&backgroundColor=b6e3f4`;
  if (safeAllRides.length > 0 && safeAllRides[0].driver_name) {
    dName = safeAllRides[0].driver_name;
    dPhoto = safeAllRides[0].driver_image_url;
  }

  res.status(200).json({
    name: dName,
    photo: dPhoto,
    experience: `${safeAllRides.length} Completed Trips`,
    rating: avgRating,
    totalReviews: safeRatedRides.length,
    reviews: safeRatedRides
      .filter((r) => r.review)
      .map((r) => ({
        text: r.review,
        date: r.created_at,
        reviewerName: r.rider_name || "Passenger",
        reviewerPhoto:
          r.rider_image_url ||
          "https://api.dicebear.com/7.x/avataaars/svg?seed=pass",
        rating: r.rating,
      })),
  });
});

const nodemailer = require("nodemailer");

app.post("/api/rides/:id/email-receipt", async (req, res) => {
  const { email, ride } = req.body;

  if (!email || !ride) {
    return res.status(400).json({ error: "Missing email or ride details." });
  }

  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER || "test@gmail.com",
        pass: process.env.EMAIL_PASS || "password123",
      },
    });

    const mailOptions = {
      from: '"Ryder Support" <support@ryder.com>',
      to: email,
      subject: `Your Ryder Receipt - ${new Date(ride.created_at).toLocaleDateString()}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
          <h2 style="color: #000;">Ryder Trip Receipt</h2>
          <p style="color: #555;">Thank you for riding with us! Here are your trip details:</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
          <p><strong>Pickup:</strong> ${ride.pickup_location}</p>
          <p><strong>Dropoff:</strong> ${ride.dropoff_location}</p>
          <p><strong>Vehicle:</strong> ${ride.vehicle_type.toUpperCase()}</p>
          <p><strong>Distance:</strong> ${ride.distance_km} km</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
          <h3 style="color: #000;">Total Fare: ₹${ride.fare}</h3>
        </div>
      `,
    };

    if (!process.env.EMAIL_USER) {
      console.log(`[MOCK EMAIL] Receipt successfully sent to ${email}`);
      return res
        .status(200)
        .json({ message: "Receipt emailed successfully! (Mocked)" });
    }

    await transporter.sendMail(mailOptions);
    res.status(200).json({ message: "Receipt emailed successfully!" });
  } catch (error) {
    console.error("Email Error:", error);
    res.status(500).json({ error: "Failed to send email." });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
