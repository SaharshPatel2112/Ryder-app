"use client";

import {
  UserButton,
  SignInButton,
  SignedIn,
  SignedOut,
  useUser,
} from "@clerk/nextjs";
import dynamic from "next/dynamic";
import { useState, useEffect } from "react";
import AddressAutocomplete from "../components/AddressAutocomplete";
import RideSelector from "../components/RideSelector";
import {
  FaBars,
  FaArrowLeft,
  FaHistory,
  FaCheckCircle,
  FaRoute,
  FaStar,
  FaTimes,
  FaFilePdf,
  FaEnvelope,
} from "react-icons/fa";
import Link from "next/link";
import jsPDF from "jspdf";

import { loadStripe } from "@stripe/stripe-js";
import { Elements } from "@stripe/react-stripe-js";
import StripeCheckout from "../components/StripeCheckout";

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!,
);
const RyderMap = dynamic(() => import("../components/Map"), { ssr: false });

export default function Home() {
  const { user } = useUser();
  const [pickup, setPickup] = useState<any>(null);
  const [dropoff, setDropoff] = useState<any>(null);
  const [distance, setDistance] = useState<string | null>(null);
  const [selectedRide, setSelectedRide] = useState<string>("auto");
  const [activeRideId, setActiveRideId] = useState<string | null>(null);
  const [rideStatus, setRideStatus] = useState<string | null>(null);
  const [finalFare, setFinalFare] = useState<string | null>(null);
  const [pinMode, setPinMode] = useState<"pickup" | "dropoff" | null>(null);

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [view, setView] = useState<"booking" | "history">("booking");
  const [rideHistory, setRideHistory] = useState<any[]>([]);

  const [paymentStep, setPaymentStep] = useState<
    "select" | "upi" | "cash" | "card" | "done"
  >("select");
  const [isProcessing, setIsProcessing] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);

  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [reviewText, setReviewText] = useState("");

  const [driverProfile, setDriverProfile] = useState<any>(null);
  const [showDriverModal, setShowDriverModal] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const [emailingRideId, setEmailingRideId] = useState<string | null>(null);

  useEffect(() => {
    if (!activeRideId || rideStatus === "completed") return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(
          process.env.NEXT_PUBLIC_API_URL + "/api/rides/" + activeRideId
        );
        const data = await res.json();

        if (rideStatus === "accepted" && data.status === "requested") {
          alert("The driver had to cancel. Finding you a new driver...");
          setRideStatus("requested");
          setDriverProfile(null);
        } else {
          setRideStatus(data.status);
          if (data.fare) setFinalFare(data.fare);

          if (
            (data.status === "accepted" || data.status === "in_transit") &&
            data.driver_id &&
            !driverProfile
          ) {
            try {
              const profileRes = await fetch(
                process.env.NEXT_PUBLIC_API_URL + "/api/driver/" + data.driver_id + "/profile"
              );
              if (profileRes.ok) {
                const profileData = await profileRes.json();
                profileData.name =
                  data.driver_name || profileData.name || "Ryder Driver";
                profileData.photo =
                  data.driver_image_url ||
                  profileData.photo ||
                  `https://api.dicebear.com/7.x/avataaars/svg?seed=${data.driver_id}`;
                setDriverProfile(profileData);
              }
            } catch (err) {
              console.error("Failed to load driver profile", err);
            }
          }
        }
      } catch (error) {
        console.error(error);
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [activeRideId, rideStatus, driverProfile]);

  useEffect(() => {
    const fetchHistory = async () => {
      if (!user || view !== "history") return;
      try {
        const res = await fetch(
          process.env.NEXT_PUBLIC_API_URL + "/api/rider/" + user.id + "/history"
        );
        const data = await res.json();
        setRideHistory(data);
      } catch (error) {
        console.error(error);
      }
    };
    fetchHistory();
  }, [view, user]);

  const handleConfirmBooking = async () => {
    if (!user) {
      alert("Please sign in to book a ride!");
      return;
    }
    if (!pickup || !dropoff || !distance) return;

    const rates: Record<string, number> = {
      bike: 8,
      auto: 12,
      car: 18,
      suv: 24,
      premium: 32,
    };
    const calculatedFare = (parseFloat(distance) * rates[selectedRide]).toFixed(
      0,
    );

    try {
      const response = await fetch(
        process.env.NEXT_PUBLIC_API_URL + "/api/rides",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            rider_id: user.id,
            rider_name: user.fullName || user.firstName || "Passenger",
            rider_image_url: user.imageUrl || "",
            pickup_location: pickup.address || pickup.name,
            dropoff_location: dropoff.address || dropoff.name,
            pickup_lat: pickup.lat,
            pickup_lon: pickup.lon,
            dropoff_lat: dropoff.lat,
            dropoff_lon: dropoff.lon,
            fare: parseFloat(calculatedFare),
            distance_km: parseFloat(distance),
            vehicle_type: selectedRide,
          }),
        },
      );
      const data = await response.json();
      if (response.ok) {
        setActiveRideId(data.ride.id);
        setRideStatus("requested");
        setFinalFare(calculatedFare);
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleCustomerCancel = async () => {
    if (!activeRideId) return;
    try {
      await fetch(
        process.env.NEXT_PUBLIC_API_URL + "/api/rides/" + activeRideId + "/cancel-by-rider",
        { method: "PUT" },
      );
      handleResetFlow();
    } catch (error) {
      console.error(error);
    }
  };

  const handlePayment = async (method: string) => {
    if (!activeRideId) return;
    setIsProcessing(true);
    try {
      await fetch(
        process.env.NEXT_PUBLIC_API_URL + "/api/rides/" + activeRideId + "/pay",
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ payment_method: method }),
        },
      );
      setPaymentStep("done");
    } catch (error) {
      console.error(error);
    }
    setIsProcessing(false);
  };

  const initiateStripePayment = async () => {
    setPaymentStep("card");
    try {
      const res = await fetch(
        process.env.NEXT_PUBLIC_API_URL + "/api/create-payment-intent",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fare: finalFare }),
        },
      );
      const data = await res.json();
      setClientSecret(data.clientSecret);
    } catch (error) {
      console.error("Failed to init Stripe", error);
    }
  };

  const handleSubmitReview = async () => {
    if (!activeRideId) return;
    try {
      await fetch(
        process.env.NEXT_PUBLIC_API_URL + "/api/rides/" + activeRideId + "/rate",
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rating: rating, review: reviewText }),
        },
      );
      handleResetFlow();
    } catch (error) {
      console.error(error);
    }
  };

  const handleResetFlow = () => {
    setActiveRideId(null);
    setRideStatus(null);
    setPickup(null);
    setDropoff(null);
    setPaymentStep("select");
    setRating(0);
    setReviewText("");
    setClientSecret(null);
    setDriverProfile(null);
    setShowDriverModal(false);
  };

  const handleDownloadReceipt = (ride: any) => {
    const doc = new jsPDF();
    let currentY = 20;

    doc.setFontSize(24);
    doc.setTextColor(0, 0, 0);
    doc.text("Ryder", 20, currentY);
    currentY += 8;

    doc.setFontSize(14);
    doc.setTextColor(100, 100, 100);
    doc.text("Receipt of your ride!", 20, currentY);
    currentY += 10;

    doc.setDrawColor(200, 200, 200);
    doc.line(20, currentY, 190, currentY);
    currentY += 10;

    doc.setFontSize(12);
    doc.setTextColor(50, 50, 50);
    doc.text(`Date: ${formatDate(ride.created_at)}`, 20, currentY);
    currentY += 8;
    doc.text(`Status: ${ride.status.toUpperCase()}`, 20, currentY);
    currentY += 8;
    doc.text(`Vehicle: ${ride.vehicle_type.toUpperCase()}`, 20, currentY);
    currentY += 12;

    const cleanStr = (str: string) =>
      (str || "")
        .replace(/[^\x00-\x7F]/g, "")
        .replace(/,\s*,/g, ",")
        .trim();
    const safePickup = cleanStr(ride.pickup_location);
    const safeDropoff = cleanStr(ride.dropoff_location);

    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text("Pickup:", 20, currentY);
    currentY += 6;
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    const splitPickup = doc.splitTextToSize(safePickup, 170);
    doc.text(splitPickup, 20, currentY);
    currentY += splitPickup.length * 5 + 6;

    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text("Dropoff:", 20, currentY);
    currentY += 6;
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    const splitDropoff = doc.splitTextToSize(safeDropoff, 170);
    doc.text(splitDropoff, 20, currentY);
    currentY += splitDropoff.length * 5 + 8;

    doc.setFontSize(12);
    doc.setTextColor(50, 50, 50);
    doc.text(`Distance: ${ride.distance_km} km`, 20, currentY);
    currentY += 10;

    doc.line(20, currentY, 190, currentY);
    currentY += 15;

    doc.setFontSize(18);
    doc.setTextColor(0, 0, 0);
    doc.text(`Total: INR ${ride.fare}`, 20, currentY);
    currentY += 20;

    doc.setFontSize(11);
    doc.setTextColor(120, 120, 120);
    const thankYouMsg =
      "Thank you for riding with Ryder! We hope you enjoyed your journey and had a safe, comfortable trip. We look forward to seeing you again soon.";
    const splitThankYou = doc.splitTextToSize(thankYouMsg, 170);
    doc.text(splitThankYou, 20, currentY);

    doc.save(`Ryder_Receipt_${ride.id.substring(0, 6)}.pdf`);
  };

  const handleEmailReceipt = async (ride: any) => {
    if (!user?.primaryEmailAddress?.emailAddress) {
      alert("No email address linked to your account.");
      return;
    }

    setEmailingRideId(ride.id);
    try {
      const res = await fetch(
        process.env.NEXT_PUBLIC_API_URL + "/api/rides/" + ride.id + "/email-receipt",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: user.primaryEmailAddress.emailAddress,
            ride: ride,
          }),
        },
      );

      if (res.ok) {
        alert(`Receipt sent to ${user.primaryEmailAddress.emailAddress}!`);
      } else {
        alert("Failed to send email.");
      }
    } catch (error) {
      console.error(error);
    }
    setEmailingRideId(null);
  };

  const handleMapClick = async (lat: number, lng: number) => {
    if (!pinMode) return;
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`,
      );
      const data = await res.json();
      const newLocation = {
        name: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
        address: data.display_name,
        lat: lat.toString(),
        lon: lng.toString(),
      };
      if (pinMode === "pickup") setPickup(newLocation);
      if (pinMode === "dropoff") setDropoff(newLocation);
      setPinMode(null);
    } catch (error) {
      console.error(error);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-IN", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const DriverCard = () =>
    driverProfile && (
      <div
        onClick={() => setShowDriverModal(true)}
        className="flex items-center gap-4 bg-white p-4 rounded-2xl border-2 border-transparent hover:border-blue-500 shadow-sm cursor-pointer transition-all mb-4 group relative overflow-hidden"
      >
        <div className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-300 group-hover:text-blue-500 transition-colors font-bold">
          &rarr;
        </div>
        <img
          src={driverProfile.photo}
          alt="Driver"
          className="w-14 h-14 rounded-full bg-blue-50 border border-blue-100 object-cover"
        />
        <div className="flex-1">
          <p className="font-black text-gray-900 text-lg leading-tight group-hover:text-blue-600 transition-colors">
            {driverProfile.name}
          </p>
          <div className="flex items-center gap-2 text-xs font-bold text-gray-500 mt-1">
            <span className="flex items-center text-yellow-500">
              <FaStar className="mr-1 mb-0.5" /> {driverProfile.rating}
            </span>
            <span>•</span>
            <span>{driverProfile.experience}</span>
          </div>
        </div>
      </div>
    );

  return (
    <main className="flex flex-col h-screen w-screen overflow-hidden bg-gray-100">
      <nav className="h-20 bg-white shadow-md z-20 flex items-center justify-between px-6 lg:px-10 shrink-0 relative">
        <h1 className="text-3xl font-extrabold text-black tracking-tight">
          Ryder
        </h1>
        <div className="flex items-center gap-4">
          <div className="relative flex items-center">
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="w-10 h-10 flex items-center justify-center bg-gray-50 hover:bg-gray-200 rounded-full transition text-black shadow-sm border border-gray-100"
            >
              <FaBars size={18} />
            </button>
            {isMenuOpen && (
              <div className="absolute right-0 top-12 mt-2 w-56 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden z-50">
                <Link
                  href="/driver"
                  className="block px-5 py-4 text-sm font-bold text-gray-700 hover:bg-blue-50 hover:text-blue-600 border-b border-gray-50 transition-colors"
                >
                  Drive with Ryder
                </Link>
                <button
                  onClick={() => {
                    setView("history");
                    setIsMenuOpen(false);
                  }}
                  className="w-full text-left block px-5 py-4 text-sm font-bold text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                >
                  Ride History
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center justify-center h-10 min-w-[80px]">
            {!isMounted ? (
              <div className="w-6 h-6 border-2 border-gray-200 border-t-black rounded-full animate-spin"></div>
            ) : (
              <>
                <SignedOut>
                  <SignInButton mode="modal">
                    <button className="bg-black text-white px-5 h-10 rounded-xl font-bold hover:bg-gray-800 transition shadow-sm flex items-center justify-center text-sm whitespace-nowrap">
                      Sign In
                    </button>
                  </SignInButton>
                </SignedOut>
                <SignedIn>
                  <UserButton
                    afterSignOutUrl="/"
                    appearance={{
                      elements: {
                        userButtonAvatarBox: { width: "40px", height: "40px" },
                      },
                    }}
                  />
                </SignedIn>
              </>
            )}
          </div>
        </div>
      </nav>

      <div className="flex flex-1 overflow-hidden relative z-10">
        <div className="w-[450px] bg-white shadow-[10px_0_15px_-3px_rgba(0,0,0,0.1)] z-20 flex flex-col relative">
          {showDriverModal && driverProfile && (
            <div className="absolute inset-0 bg-white z-50 p-8 flex flex-col animate-fade-in overflow-y-auto">
              <div className="flex justify-between items-start mb-8">
                <h2 className="text-2xl font-black text-gray-900">
                  Driver Profile
                </h2>
                <button
                  onClick={() => setShowDriverModal(false)}
                  className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 text-gray-600 transition-colors"
                >
                  <FaTimes size={16} />
                </button>
              </div>
              <div className="flex flex-col items-center text-center mb-8">
                <img
                  src={driverProfile.photo}
                  alt="Driver"
                  className="w-32 h-32 rounded-full bg-blue-50 border-4 border-white shadow-xl mb-4 object-cover"
                />
                <h3 className="text-3xl font-black text-gray-900">
                  {driverProfile.name}
                </h3>
                <p className="text-gray-500 font-bold uppercase tracking-wider text-sm mt-1">
                  {driverProfile.experience}
                </p>
              </div>
              <div className="flex justify-center gap-8 mb-10 pb-8 border-b border-gray-100">
                <div className="text-center">
                  <p className="text-4xl font-black flex items-center justify-center gap-1">
                    <FaStar className="text-yellow-400 text-3xl" />{" "}
                    {driverProfile.rating}
                  </p>
                  <p className="text-xs text-gray-400 font-bold uppercase tracking-wider mt-2">
                    Rating
                  </p>
                </div>
                <div className="w-px bg-gray-200"></div>
                <div className="text-center">
                  <p className="text-4xl font-black">
                    {driverProfile.totalReviews}
                  </p>
                  <p className="text-xs text-gray-400 font-bold uppercase tracking-wider mt-2">
                    Reviews
                  </p>
                </div>
              </div>
              <div>
                <h4 className="font-bold text-gray-900 mb-4 uppercase tracking-wider text-sm">
                  Recent Feedback
                </h4>
                {driverProfile?.reviews?.length === 0 ? (
                  <p className="text-gray-500 text-sm italic">
                    No written reviews yet.
                  </p>
                ) : (
                  <div className="flex flex-col gap-4">
                    {driverProfile.reviews.map((r: any, i: number) => (
                      <div
                        key={i}
                        className="bg-gray-50 p-4 rounded-2xl border border-gray-100 relative"
                      >
                        <div className="absolute top-4 right-4 flex gap-0.5">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <FaStar
                              key={star}
                              className={`text-xs ${star <= r.rating ? "text-yellow-400" : "text-gray-200"}`}
                            />
                          ))}
                        </div>
                        <div className="flex items-center gap-3 mb-3 relative z-10 pr-20">
                          <img
                            src={r.reviewerPhoto}
                            alt="Passenger"
                            className="w-8 h-8 rounded-full bg-gray-200 border border-gray-300 object-cover"
                          />
                          <p className="text-xs font-bold text-gray-900">
                            {r.reviewerName}
                          </p>
                        </div>
                        <p className="text-gray-700 italic text-sm relative z-10">
                          "{r.text}"
                        </p>
                        <p className="text-[10px] text-gray-400 font-bold mt-2 uppercase tracking-wider">
                          {formatDate(r.date)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="p-8 flex flex-col gap-6 flex-1 overflow-y-auto pb-32">
            {view === "history" ? (
              <div className="animate-fade-in">
                <button
                  onClick={() => setView("booking")}
                  className="flex items-center gap-2 text-sm font-bold text-blue-600 hover:text-blue-800 mb-6 transition-colors"
                >
                  <FaArrowLeft /> Back to Booking
                </button>
                <h2 className="text-3xl font-bold text-gray-800 mb-6 flex items-center gap-3">
                  <FaHistory className="text-gray-400" /> Past Rides
                </h2>
                {rideHistory.length === 0 ? (
                  <p className="text-gray-500 text-center mt-10 font-medium">
                    No past rides found.
                  </p>
                ) : (
                  <div className="flex flex-col gap-4">
                    {rideHistory.map((ride) => (
                      <div
                        key={ride.id}
                        className="bg-gray-50 p-5 rounded-2xl border border-gray-100 hover:shadow-md transition-shadow"
                      >
                        <div className="flex justify-between items-center mb-3">
                          <span
                            className={`text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider ${ride.status === "completed" ? "bg-green-100 text-green-700" : ride.status === "canceled" ? "bg-red-100 text-red-700" : "bg-gray-200 text-gray-600"}`}
                          >
                            {ride.status}
                          </span>
                          <span className="text-xs font-bold text-gray-500">
                            {formatDate(ride.created_at)}
                          </span>
                        </div>
                        <div className="space-y-2 mb-3">
                          <div className="flex gap-3 items-center">
                            <div className="w-2 h-2 rounded-full bg-black"></div>
                            <p className="text-sm text-gray-700 font-medium truncate">
                              {ride.pickup_location}
                            </p>
                          </div>
                          <div className="flex gap-3 items-center">
                            <div className="w-2 h-2 rounded-full bg-blue-600"></div>
                            <p className="text-sm text-gray-700 font-medium truncate">
                              {ride.dropoff_location}
                            </p>
                          </div>
                        </div>
                        <div className="flex justify-between items-end border-t border-gray-200 pt-3 mb-4">
                          <span className="text-xs font-bold text-gray-400 uppercase">
                            {ride.vehicle_type} • {ride.distance_km} km
                          </span>
                          <span className="text-xl font-black text-black">
                            ₹{ride.fare}
                          </span>
                        </div>

                        {ride.status === "completed" && (
                          <div className="flex gap-2 pt-3 border-t border-gray-100">
                            <button
                              onClick={() => handleDownloadReceipt(ride)}
                              className="flex-1 bg-white border border-gray-200 py-2 rounded-xl text-xs font-bold text-gray-700 hover:bg-gray-100 transition-colors flex justify-center items-center gap-2 shadow-sm"
                            >
                              <FaFilePdf className="text-red-500" /> Download
                              PDF
                            </button>
                            <button
                              onClick={() => handleEmailReceipt(ride)}
                              disabled={emailingRideId === ride.id}
                              className="flex-1 bg-white border border-gray-200 py-2 rounded-xl text-xs font-bold text-gray-700 hover:bg-gray-100 transition-colors flex justify-center items-center gap-2 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {emailingRideId === ride.id ? (
                                <div className="w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
                              ) : (
                                <>
                                  <FaEnvelope className="text-blue-500" /> Email
                                </>
                              )}
                            </button>
                          </div>
                        )}

                        {ride.rating && (
                          <div className="mt-3 flex gap-1 text-yellow-400 text-sm">
                            {[...Array(ride.rating)].map((_, i) => (
                              <FaStar key={i} />
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : rideStatus === "completed" ? (
              <div className="flex flex-col h-full animate-fade-in">
                {paymentStep === "select" && (
                  <div className="flex flex-col h-full">
                    <h2 className="text-3xl font-black text-gray-900 mb-2">
                      Checkout
                    </h2>
                    <p className="text-gray-500 mb-8 font-medium">
                      Choose how you'd like to pay for your ride.
                    </p>
                    <div className="bg-gray-900 text-white p-6 rounded-3xl mb-8 shadow-lg text-center">
                      <p className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-1">
                        Total Due
                      </p>
                      <p className="text-5xl font-black">₹{finalFare}</p>
                    </div>
                    <div className="flex flex-col gap-4">
                      <button
                        onClick={() => setPaymentStep("upi")}
                        className="w-full bg-white border-2 border-gray-100 p-4 rounded-2xl flex items-center gap-4 hover:border-blue-500 hover:bg-blue-50 transition-all text-left group"
                      >
                        <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center text-xl group-hover:scale-110 transition-transform">
                          📱
                        </div>
                        <div>
                          <p className="font-bold text-gray-900 text-lg">
                            Pay with UPI
                          </p>
                          <p className="text-xs text-gray-500 font-medium">
                            GPay, PhonePe, Paytm
                          </p>
                        </div>
                      </button>
                      <button
                        onClick={initiateStripePayment}
                        className="w-full bg-white border-2 border-gray-100 p-4 rounded-2xl flex items-center gap-4 hover:border-purple-500 hover:bg-purple-50 transition-all text-left group"
                      >
                        <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center text-xl group-hover:scale-110 transition-transform">
                          💳
                        </div>
                        <div>
                          <p className="font-bold text-gray-900 text-lg">
                            Credit / Debit Card
                          </p>
                          <p className="text-xs text-gray-500 font-medium">
                            Powered by Stripe
                          </p>
                        </div>
                      </button>
                      <button
                        onClick={() => setPaymentStep("cash")}
                        className="w-full bg-white border-2 border-gray-100 p-4 rounded-2xl flex items-center gap-4 hover:border-green-500 hover:bg-green-50 transition-all text-left group"
                      >
                        <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center text-xl group-hover:scale-110 transition-transform">
                          💵
                        </div>
                        <div>
                          <p className="font-bold text-gray-900 text-lg">
                            Pay in Cash
                          </p>
                          <p className="text-xs text-gray-500 font-medium">
                            Pay driver directly
                          </p>
                        </div>
                      </button>
                    </div>
                  </div>
                )}
                {paymentStep === "upi" && (
                  <div className="flex flex-col items-center justify-center h-full text-center">
                    <h2 className="text-2xl font-black text-gray-900 mb-2">
                      Scan to Pay
                    </h2>
                    <p className="text-gray-500 mb-8 font-medium">
                      Use any UPI app to scan this code.
                    </p>
                    <div className="bg-white p-4 rounded-3xl shadow-lg border border-gray-100 mb-6">
                      <img
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=upi://pay?pa=patelsaharsh2112@oksbi&pn=RyderDriver&am=${finalFare}`}
                        alt="UPI QR Code"
                        className="w-48 h-48"
                      />
                    </div>
                    <p className="text-3xl font-black text-black mb-8">
                      ₹{finalFare}
                    </p>
                    <button
                      onClick={() => handlePayment("UPI")}
                      disabled={isProcessing}
                      className="w-full bg-blue-600 text-white font-bold text-xl py-4 rounded-2xl shadow-lg hover:bg-blue-700 transition-all active:scale-95"
                    >
                      {isProcessing ? "Verifying..." : "I have paid"}
                    </button>
                    <button
                      onClick={() => setPaymentStep("select")}
                      className="mt-4 text-gray-500 font-bold hover:text-black"
                    >
                      Choose another method
                    </button>
                  </div>
                )}
                {paymentStep === "card" && (
                  <div className="flex flex-col h-full">
                    {!clientSecret ? (
                      <div className="flex flex-col items-center justify-center h-full text-center">
                        <div className="w-12 h-12 border-4 border-gray-200 border-t-purple-600 rounded-full animate-spin mb-4"></div>
                        <p className="text-gray-500 font-bold">
                          Connecting securely to Stripe...
                        </p>
                      </div>
                    ) : (
                      <Elements
                        stripe={stripePromise}
                        options={{ clientSecret }}
                      >
                        <StripeCheckout
                          fare={finalFare!}
                          onSuccess={() => handlePayment("Card")}
                          onCancel={() => {
                            setPaymentStep("select");
                            setClientSecret(null);
                          }}
                        />
                      </Elements>
                    )}
                  </div>
                )}
                {paymentStep === "cash" && (
                  <div className="flex flex-col items-center justify-center h-full text-center">
                    <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mb-6">
                      <span className="text-5xl">💵</span>
                    </div>
                    <h2 className="text-2xl font-black text-gray-900 mb-2">
                      Pay with Cash
                    </h2>
                    <p className="text-gray-500 mb-8 font-medium">
                      Please hand the exact amount to your driver.
                    </p>
                    <p className="text-5xl font-black text-green-600 mb-8">
                      ₹{finalFare}
                    </p>
                    <button
                      onClick={() => handlePayment("Cash")}
                      disabled={isProcessing}
                      className="w-full bg-green-500 text-black font-black text-xl py-4 rounded-2xl shadow-lg hover:bg-green-400 transition-all active:scale-95"
                    >
                      {isProcessing ? "Processing..." : "Confirm Cash Paid"}
                    </button>
                    <button
                      onClick={() => setPaymentStep("select")}
                      className="mt-6 text-gray-500 font-bold hover:text-black w-full"
                    >
                      Choose another method
                    </button>
                  </div>
                )}
                {paymentStep === "done" && (
                  <div className="flex flex-col h-full animate-fade-in">
                    <div className="flex flex-col items-center text-center mb-6">
                      <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4 text-green-600">
                        <FaCheckCircle size={32} />
                      </div>
                      <h2 className="text-2xl font-black text-gray-900">
                        Payment Successful!
                      </h2>
                      <p className="text-gray-500 font-medium">
                        ₹{finalFare} paid securely.
                      </p>
                    </div>
                    <div className="bg-white p-6 rounded-3xl border border-gray-100 flex-1 flex flex-col items-center shadow-sm">
                      <h3 className="text-lg font-bold text-gray-800 mb-4">
                        How was your ride?
                      </h3>
                      <div className="flex gap-2 mb-6">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            type="button"
                            onClick={() => setRating(star)}
                            onMouseEnter={() => setHoverRating(star)}
                            onMouseLeave={() => setHoverRating(0)}
                            className="text-4xl transition-transform hover:scale-110 focus:outline-none"
                          >
                            <FaStar
                              className={
                                (hoverRating || rating) >= star
                                  ? "text-yellow-400"
                                  : "text-gray-200"
                              }
                            />
                          </button>
                        ))}
                      </div>
                      <textarea
                        value={reviewText}
                        onChange={(e) => setReviewText(e.target.value)}
                        placeholder="Leave a compliment or feedback (optional)"
                        className="w-full bg-gray-50 border border-gray-200 p-4 rounded-xl text-sm mb-6 resize-none focus:ring-2 focus:ring-black outline-none text-black"
                        rows={4}
                      />
                      <button
                        onClick={handleSubmitReview}
                        disabled={rating === 0}
                        className="w-full bg-black text-white font-bold text-xl py-4 rounded-2xl shadow-lg hover:bg-gray-800 transition-all active:scale-95 disabled:bg-gray-300 disabled:cursor-not-allowed mb-4"
                      >
                        Submit Review
                      </button>
                      <button
                        onClick={handleResetFlow}
                        className="text-gray-400 font-bold hover:text-black text-sm"
                      >
                        Skip & Return Home
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : rideStatus === "in_transit" ? (
              <div className="flex flex-col items-center justify-center text-center h-full animate-fade-in">
                <div className="w-24 h-24 bg-blue-100 rounded-full flex items-center justify-center mb-6 shadow-inner text-blue-600">
                  <FaRoute size={48} />
                </div>
                <h2 className="text-3xl font-black text-gray-900 mb-2">
                  You're on your way!
                </h2>
                <p className="text-gray-500 mb-6 font-medium">
                  Enjoy your ride to your destination.
                </p>
                <div className="bg-gray-50 p-6 rounded-2xl border border-gray-100 w-full text-left">
                  <DriverCard />
                  <p className="text-sm text-gray-400 font-bold uppercase tracking-wider mb-1 mt-4">
                    Destination
                  </p>
                  <p className="font-semibold text-gray-800 mb-4 truncate">
                    {dropoff?.name}
                  </p>
                  <p className="text-sm text-gray-400 font-bold uppercase tracking-wider mb-1">
                    Ride Bill
                  </p>
                  <p className="font-black text-2xl text-blue-600">
                    ₹{finalFare}
                  </p>
                </div>
              </div>
            ) : rideStatus === "accepted" ? (
              <div className="flex flex-col items-center justify-center text-center h-full animate-fade-in">
                <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mb-6 shadow-inner">
                  <span className="text-5xl">🚕</span>
                </div>
                <h2 className="text-3xl font-black text-gray-900 mb-2">
                  Driver is on the way!
                </h2>
                <p className="text-gray-500 mb-6 font-medium">
                  Your ride has been confirmed and is heading to your pickup
                  location.
                </p>
                <div className="bg-gray-50 p-6 rounded-2xl border border-gray-100 w-full text-left">
                  <DriverCard />
                  <p className="text-sm text-gray-400 font-bold uppercase tracking-wider mb-1 mt-4">
                    Pickup
                  </p>
                  <p className="font-semibold text-gray-800 mb-4 truncate">
                    {pickup?.name}
                  </p>
                  <p className="text-sm text-gray-400 font-bold uppercase tracking-wider mb-1">
                    Ride Bill
                  </p>
                  <p className="font-black text-2xl text-green-600">
                    ₹{finalFare}
                  </p>
                </div>
                <button
                  onClick={handleCustomerCancel}
                  className="mt-8 text-red-500 font-bold hover:text-red-700 transition-colors py-3 px-6 rounded-xl hover:bg-red-50"
                >
                  Cancel Ride
                </button>
              </div>
            ) : rideStatus === "requested" ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="w-16 h-16 border-4 border-gray-200 border-t-black rounded-full animate-spin mb-6"></div>
                <h2 className="text-xl font-bold text-gray-800 mb-8">
                  Finding you a driver...
                </h2>
                <button
                  onClick={handleCustomerCancel}
                  className="text-red-500 font-bold hover:text-red-700 transition-colors py-3 px-8 rounded-xl bg-red-50 hover:bg-red-100"
                >
                  Cancel Request
                </button>
              </div>
            ) : (
              <>
                <h2 className="text-3xl font-bold text-gray-800 mb-2">
                  Request a ride
                </h2>
                <div className="flex flex-col gap-5">
                  <AddressAutocomplete
                    placeholder="Enter pickup location"
                    selectedValue={pickup?.name || ""}
                    onSelectAddress={(address) => setPickup(address)}
                    onActivatePinDrop={() =>
                      setPinMode(pinMode === "pickup" ? null : "pickup")
                    }
                    isPinActive={pinMode === "pickup"}
                  />
                  <AddressAutocomplete
                    placeholder="Enter destination"
                    selectedValue={dropoff?.name || ""}
                    onSelectAddress={(address) => setDropoff(address)}
                    onActivatePinDrop={() =>
                      setPinMode(pinMode === "dropoff" ? null : "dropoff")
                    }
                    isPinActive={pinMode === "dropoff"}
                  />
                </div>
                {distance && (
                  <div className="flex flex-col gap-4 mt-2">
                    <div className="bg-blue-50 text-blue-800 p-5 rounded-xl border border-blue-100 flex flex-col justify-center shadow-sm">
                      <span className="font-medium text-sm block mb-1">
                        Total Distance
                      </span>
                      <span className="font-black text-2xl">{distance} km</span>
                    </div>
                    <RideSelector
                      distance={distance}
                      selectedRide={selectedRide}
                      setSelectedRide={setSelectedRide}
                    />
                    <button
                      onClick={handleConfirmBooking}
                      className="w-full bg-black text-white font-bold text-xl py-5 rounded-2xl mt-4 hover:bg-gray-800 transition-all shadow-xl active:scale-[0.98]"
                    >
                      Confirm {selectedRide.toUpperCase()}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        <div
          id="main-map-area"
          className="flex-1 h-full relative z-0 transition-all duration-500 ease-out"
        >
          <RyderMap
            pickup={pickup}
            dropoff={dropoff}
            setDistance={setDistance}
            onMapClick={handleMapClick}
          />
        </div>
      </div>
    </main>
  );
}