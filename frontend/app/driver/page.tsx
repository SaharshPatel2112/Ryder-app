"use client";

import { useEffect, useState } from "react";
import {
  UserButton,
  SignInButton,
  SignedIn,
  SignedOut,
  useUser,
} from "@clerk/nextjs";
import dynamic from "next/dynamic";
import {
  FaTrophy,
  FaCheckCircle,
  FaBars,
  FaArrowLeft,
  FaHistory,
  FaTimesCircle,
  FaStar,
  FaFilePdf,
  FaEnvelope,
} from "react-icons/fa";
import Link from "next/link";
import jsPDF from "jspdf";

const RyderMap = dynamic(() => import("../../components/Map"), { ssr: false });

export default function DriverDashboard() {
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);
  const { user } = useUser();
  const [availableRides, setAvailableRides] = useState<any[]>([]);
  const [myActiveRide, setMyActiveRide] = useState<any>(null);
  const [expandedMapId, setExpandedMapId] = useState<string | null>(null);
  const [stats, setStats] = useState({
    totalRides: 0,
    totalFare: "0.00",
    totalDistance: "0.0",
  });
  const [isOnDuty, setIsOnDuty] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const [view, setView] = useState<"dashboard" | "history" | "ratings">(
    "dashboard",
  );
  const [rideHistory, setRideHistory] = useState<any[]>([]);
  const [driverProfile, setDriverProfile] = useState<any>(null);

  const [emailingRideId, setEmailingRideId] = useState<string | null>(null);

  const fetchData = async () => {
    if (!user) return;
    try {
      const res = await fetch("http://localhost:5000/api/rides/requested");
      if (res.ok) {
        const allRides = await res.json();
        setAvailableRides(
          allRides.filter((r: any) => r.status === "requested"),
        );
      }

      const resStats = await fetch(
        `http://localhost:5000/api/driver/${user.id}/stats`,
      );
      if (resStats.ok) {
        const dataStats = await resStats.json();
        setStats(dataStats);
      }

      const resHistory = await fetch(
        `http://localhost:5000/api/driver/${user.id}/history`,
      );
      if (resHistory.ok) {
        const dataHistory = await resHistory.json();
        setRideHistory(dataHistory || []);
      }

      const resProfile = await fetch(
        `http://localhost:5000/api/driver/${user.id}/profile`,
      );
      if (resProfile.ok) {
        const dataProfile = await resProfile.json();
        setDriverProfile(dataProfile);
      }

      if (myActiveRide) {
        const rideCheck = await fetch(
          `http://localhost:5000/api/rides/${myActiveRide.id}`,
        );
        if (rideCheck.ok) {
          const rideData = await rideCheck.json();
          if (rideData.status === "canceled") {
            alert("The passenger has canceled the ride.");
            setMyActiveRide(null);
          }
        }
      }
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, [user, myActiveRide]);

  const handleAcceptRide = async (ride: any) => {
    if (!user) return;
    try {
      const res = await fetch(
        `http://localhost:5000/api/rides/${ride.id}/accept`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            driver_id: user.id,
            driver_name: user.fullName || user.firstName || "Ryder Driver",
            driver_image_url: user.imageUrl || "",
          }),
        },
      );
      if (res.ok) {
        setMyActiveRide({ ...ride, status: "accepted" });
        setAvailableRides(availableRides.filter((r) => r.id !== ride.id));
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleConfirmPickup = async (rideId: string) => {
    try {
      const res = await fetch(
        `http://localhost:5000/api/rides/${rideId}/pickup`,
        { method: "PUT" },
      );
      if (res.ok) {
        setMyActiveRide({ ...myActiveRide, status: "in_transit" });
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleCompleteRide = async (rideId: string) => {
    try {
      const res = await fetch(
        `http://localhost:5000/api/rides/${rideId}/complete`,
        { method: "PUT" },
      );
      if (res.ok) {
        setMyActiveRide(null);
        fetchData();
        alert("🎉 Dropoff Complete! Earnings updated.");
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleDriverCancel = async (rideId: string) => {
    const confirmCancel = window.confirm(
      "Are you sure you want to drop this ride? It will be sent back to other drivers.",
    );
    if (!confirmCancel) return;

    try {
      const res = await fetch(
        `http://localhost:5000/api/rides/${rideId}/cancel-by-driver`,
        { method: "PUT" },
      );
      if (res.ok) {
        setMyActiveRide(null);
        fetchData();
      }
    } catch (error) {
      console.error(error);
    }
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
    doc.text("Driver Earnings Receipt", 20, currentY);
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
    doc.text(`Total Earnings: INR ${ride.fare}`, 20, currentY);
    currentY += 20;

    doc.setFontSize(11);
    doc.setTextColor(120, 120, 120);
    const thankYouMsg =
      "Thank you for driving with Ryder! Your efforts keep the city moving and passengers safe.";
    const splitThankYou = doc.splitTextToSize(thankYouMsg, 170);
    doc.text(splitThankYou, 20, currentY);

    doc.save(`Ryder_Earnings_${ride.id.substring(0, 6)}.pdf`);
  };

  const handleEmailReceipt = async (ride: any) => {
    if (!user?.primaryEmailAddress?.emailAddress) {
      alert("No email address linked to your account.");
      return;
    }

    setEmailingRideId(ride.id);
    try {
      const res = await fetch(
        `http://localhost:5000/api/rides/${ride.id}/email-receipt`,
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
        alert(
          `Earnings receipt sent to ${user.primaryEmailAddress.emailAddress}!`,
        );
      } else {
        alert("Failed to send email.");
      }
    } catch (error) {
      console.error(error);
    }
    setEmailingRideId(null);
  };

  const dist = parseFloat(stats.totalDistance);
  let rank = "Rookie Ryder";
  let rankColor = "text-gray-500";
  let nextGoal = 100;
  if (dist >= 750) {
    const level = Math.floor(dist / 250) - 2;
    rank = `Diamond Level ${level}`;
    rankColor = "text-blue-500";
    nextGoal = (Math.floor(dist / 250) + 1) * 250;
  } else if (dist >= 500) {
    rank = "Gold Ryder";
    rankColor = "text-yellow-500";
    nextGoal = 750;
  } else if (dist >= 250) {
    rank = "Silver Ryder";
    rankColor = "text-slate-400";
    nextGoal = 500;
  } else if (dist >= 100) {
    rank = "Bronze Ryder";
    rankColor = "text-orange-500";
    nextGoal = 250;
  }
  const progressPercent = Math.min((dist / nextGoal) * 100, 100);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-IN", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <main className="min-h-screen bg-gray-50 text-gray-900 p-6 font-sans relative overflow-x-hidden">
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-200/40 rounded-full blur-3xl z-0 pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-green-200/40 rounded-full blur-3xl z-0 pointer-events-none"></div>

      <div className="relative z-10 max-w-5xl mx-auto">
        <header className="relative z-50 flex justify-between items-center mb-6 bg-white/60 backdrop-blur-xl p-4 rounded-3xl border border-white/80 shadow-sm">
          <div className="flex items-center gap-6">
            <h1 className="text-3xl font-extrabold text-black tracking-tight">
              Ryder
            </h1>
            {user && (
              <div className="flex items-center gap-3 bg-white/50 px-4 py-2 rounded-full border border-white/60">
                <span
                  className={`font-bold text-sm ${isOnDuty ? "text-green-600" : "text-gray-500"}`}
                >
                  {isOnDuty ? "On Duty" : "Off Duty"}
                </span>
                <button
                  onClick={() => {
                    if (myActiveRide && isOnDuty) {
                      alert(
                        "⚠️ You must complete your current trip before going off duty!",
                      );
                      return;
                    }
                    setIsOnDuty(!isOnDuty);
                  }}
                  className={`w-14 h-7 rounded-full transition-all flex items-center px-1 shadow-inner ${myActiveRide ? "opacity-50 cursor-not-allowed " : "cursor-pointer "}${isOnDuty ? "bg-green-500" : "bg-gray-300"}`}
                >
                  <div
                    className={`w-5 h-5 bg-white rounded-full shadow-md transition-transform duration-300 ${isOnDuty ? "translate-x-7" : "translate-x-0"}`}
                  ></div>
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-4">
            <div className="relative flex items-center">
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="w-10 h-10 flex items-center justify-center bg-white hover:bg-gray-100 rounded-full transition text-black shadow-sm border border-gray-100"
              >
                <FaBars size={18} />
              </button>
              {isMenuOpen && (
                <div className="absolute right-0 top-12 mt-2 w-56 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden z-50">
                  <Link
                    href="/"
                    className="block px-5 py-4 text-sm font-bold text-gray-700 hover:bg-blue-50 hover:text-blue-600 border-b border-gray-50 transition-colors"
                  >
                    Rider Mode
                  </Link>
                  <button
                    onClick={() => {
                      setView("history");
                      setIsMenuOpen(false);
                    }}
                    className="w-full text-left block px-5 py-4 text-sm font-bold text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-colors border-b border-gray-50"
                  >
                    Duty History
                  </button>
                  <button
                    onClick={() => {
                      setView("ratings");
                      setIsMenuOpen(false);
                    }}
                    className="w-full text-left block px-5 py-4 text-sm font-bold text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                  >
                    My Ratings
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
                        Sign In to Drive
                      </button>
                    </SignInButton>
                  </SignedOut>
                  <SignedIn>
                    <UserButton
                      afterSignOutUrl="/"
                      appearance={{
                        elements: {
                          userButtonAvatarBox: {
                            width: "40px",
                            height: "40px",
                          },
                        },
                      }}
                    />
                  </SignedIn>
                </>
              )}
            </div>
          </div>
        </header>

        {view === "ratings" ? (
          <div className="bg-white/80 backdrop-blur-md rounded-3xl p-8 border border-white shadow-sm animate-fade-in relative z-10">
            <button
              onClick={() => setView("dashboard")}
              className="flex items-center gap-2 text-sm font-bold text-blue-600 hover:text-blue-800 mb-8 transition-colors"
            >
              <FaArrowLeft /> Back to Dashboard
            </button>
            <h2 className="text-3xl font-black mb-8 text-gray-900 flex items-center gap-3">
              <FaStar className="text-yellow-400" /> My Ratings
            </h2>

            {driverProfile ? (
              <>
                <div className="flex justify-center gap-12 mb-10 pb-8 border-b border-gray-200">
                  <div className="text-center">
                    <p className="text-5xl font-black flex items-center justify-center gap-2 text-gray-900">
                      <FaStar className="text-yellow-400 text-4xl" />{" "}
                      {driverProfile.rating}
                    </p>
                    <p className="text-sm text-gray-500 font-bold uppercase tracking-wider mt-3">
                      Average Rating
                    </p>
                  </div>
                  <div className="w-px bg-gray-200"></div>
                  <div className="text-center">
                    <p className="text-5xl font-black text-gray-900">
                      {driverProfile.totalReviews}
                    </p>
                    <p className="text-sm text-gray-500 font-bold uppercase tracking-wider mt-3">
                      Total Reviews
                    </p>
                  </div>
                </div>

                <div>
                  <h4 className="font-black text-gray-900 mb-6 uppercase tracking-wider text-sm">
                    Passenger Feedback
                  </h4>
                  {driverProfile.reviews?.length === 0 ? (
                    <p className="text-gray-500 text-center py-10 font-medium bg-gray-50 rounded-3xl border border-gray-100">
                      You don't have any written reviews yet. Keep driving!
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {driverProfile.reviews.map((r: any, i: number) => (
                        <div
                          key={i}
                          className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm relative hover:shadow-md transition-shadow"
                        >
                          <div className="absolute top-6 right-6 flex gap-1">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <FaStar
                                key={star}
                                className={`text-sm ${star <= r.rating ? "text-yellow-400" : "text-gray-200"}`}
                              />
                            ))}
                          </div>

                          <div className="flex items-center gap-4 mb-4 relative z-10 pr-24">
                            <img
                              src={r.reviewerPhoto}
                              alt="Passenger"
                              className="w-10 h-10 rounded-full bg-gray-200 border border-gray-200 object-cover"
                            />
                            <p className="font-bold text-gray-900">
                              {r.reviewerName}
                            </p>
                          </div>

                          <p className="text-gray-600 italic leading-relaxed text-sm">
                            "{r.text}"
                          </p>
                          <p className="text-[10px] text-gray-400 font-bold mt-4 uppercase tracking-wider">
                            {formatDate(r.date)}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex justify-center py-20">
                <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              </div>
            )}
          </div>
        ) : view === "history" ? (
          <div className="bg-white/80 backdrop-blur-md rounded-3xl p-8 border border-white shadow-sm animate-fade-in relative z-10">
            <button
              onClick={() => setView("dashboard")}
              className="flex items-center gap-2 text-sm font-bold text-blue-600 hover:text-blue-800 mb-6 transition-colors"
            >
              <FaArrowLeft /> Back to Dashboard
            </button>
            <h2 className="text-3xl font-black mb-6 text-gray-900 flex items-center gap-3">
              <FaHistory className="text-gray-400" /> Driver Trip History
            </h2>
            {rideHistory.length === 0 ? (
              <p className="text-gray-500 text-center py-10 font-medium">
                You haven't completed any trips yet.
              </p>
            ) : (
              <div className="flex flex-col gap-4">
                {rideHistory.map((trip) => (
                  <div
                    key={trip.id}
                    className="bg-gray-50 rounded-2xl p-5 border border-gray-100 flex flex-col gap-4 hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="bg-green-100 text-green-700 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider">
                            Completed
                          </span>
                          <span className="text-xs text-gray-500 font-bold">
                            {formatDate(trip.created_at)}
                          </span>
                          <span className="text-xs text-gray-400 font-bold px-2 border-l-2 border-gray-200 capitalize">
                            {trip.vehicle_type}
                          </span>
                        </div>
                        <div className="space-y-1.5 mt-3">
                          <div className="flex gap-3 items-center">
                            <div className="w-2 h-2 rounded-full bg-black"></div>
                            <p
                              className="text-sm text-gray-600 truncate max-w-[300px]"
                              title={trip.pickup_location}
                            >
                              {trip.pickup_location}
                            </p>
                          </div>
                          <div className="flex gap-3 items-center">
                            <div className="w-2 h-2 rounded-full bg-blue-600"></div>
                            <p
                              className="text-sm text-gray-600 truncate max-w-[300px]"
                              title={trip.dropoff_location}
                            >
                              {trip.dropoff_location}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="md:text-right border-t md:border-t-0 pt-3 md:pt-0 border-gray-200 mt-2 md:mt-0">
                        <p className="text-2xl font-black text-black">
                          ₹{trip.fare}
                        </p>
                        <p className="text-xs font-bold text-gray-500 uppercase mt-1">
                          {trip.distance_km} km
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-2 pt-3 border-t border-gray-200">
                      <button
                        onClick={() => handleDownloadReceipt(trip)}
                        className="flex-1 bg-white border border-gray-200 py-2 rounded-xl text-xs font-bold text-gray-700 hover:bg-gray-100 transition-colors flex justify-center items-center gap-2 shadow-sm"
                      >
                        <FaFilePdf className="text-red-500" /> PDF
                      </button>
                      <button
                        onClick={() => handleEmailReceipt(trip)}
                        disabled={emailingRideId === trip.id}
                        className="flex-1 bg-white border border-gray-200 py-2 rounded-xl text-xs font-bold text-gray-700 hover:bg-gray-100 transition-colors flex justify-center items-center gap-2 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {emailingRideId === trip.id ? (
                          <div className="w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                          <>
                            <FaEnvelope className="text-blue-500" /> Email
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <>
            {user && (
              <div className="bg-white/60 backdrop-blur-xl rounded-3xl p-8 mb-8 border border-white/80 shadow-sm relative z-10">
                <div className="flex justify-between items-end mb-6">
                  <div>
                    <p className="text-xs text-gray-500 font-extrabold uppercase tracking-wider mb-1">
                      Career Rank
                    </p>
                    <h2
                      className={`text-3xl font-black flex items-center gap-3 ${rankColor}`}
                    >
                      <FaTrophy /> {rank}
                    </h2>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500 font-extrabold uppercase tracking-wider mb-1">
                      Total Earnings
                    </p>
                    <p className="text-4xl font-black text-black">
                      ₹{stats.totalFare}
                    </p>
                  </div>
                </div>
                <div className="w-full bg-gray-200/80 rounded-full h-4 mb-2 border border-white/50 overflow-hidden shadow-inner">
                  <div
                    className="bg-black h-4 rounded-full transition-all duration-1000 relative overflow-hidden"
                    style={{ width: `${progressPercent}%` }}
                  >
                    <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer"></div>
                  </div>
                </div>
                <div className="flex justify-between text-sm font-bold text-gray-600 uppercase">
                  <span>{dist} km driven</span>
                  <span>Target: {nextGoal} km</span>
                </div>
              </div>
            )}

            {user && !isOnDuty && (
              <div className="bg-white/50 backdrop-blur-sm rounded-3xl p-12 text-center border border-white/50 shadow-sm mt-10">
                <div className="w-20 h-20 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-6">
                  <span className="text-4xl">😴</span>
                </div>
                <h2 className="text-2xl font-black text-gray-800 mb-2">
                  You are currently offline
                </h2>
                <p className="text-gray-500 font-medium max-w-md mx-auto">
                  Toggle your status to "On Duty" at the top of the screen to
                  start receiving ride requests.
                </p>
              </div>
            )}

            {user && isOnDuty && myActiveRide && (
              <section className="mb-10">
                <h2 className="text-2xl font-black mb-4 text-blue-600 flex items-center gap-3">
                  <span className="relative flex h-4 w-4">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-4 w-4 bg-blue-600"></span>
                  </span>{" "}
                  Active Trip in Progress
                </h2>
                <div className="max-w-[450px] w-full bg-white border-2 border-blue-500 rounded-3xl p-6 shadow-2xl">
                  <div className="flex justify-between items-center mb-6">
                    <span className="text-3xl font-black text-black">
                      ₹{myActiveRide.fare}
                    </span>
                    <span className="bg-blue-100 text-blue-800 text-xs font-black px-4 py-2 rounded-full uppercase tracking-wider">
                      {myActiveRide.status === "in_transit"
                        ? "In Transit"
                        : "Heading to Pickup"}
                    </span>
                  </div>
                  {myActiveRide.pickup_lat && (
                    <div className="h-56 w-full rounded-2xl overflow-hidden mb-6 border border-gray-200 shadow-inner">
                      <RyderMap
                        pickup={{
                          lat: myActiveRide.pickup_lat,
                          lon: myActiveRide.pickup_lon,
                          name: myActiveRide.pickup_location,
                        }}
                        dropoff={{
                          lat: myActiveRide.dropoff_lat,
                          lon: myActiveRide.dropoff_lon,
                          name: myActiveRide.dropoff_location,
                        }}
                        setDistance={() => {}}
                      />
                    </div>
                  )}

                  <div className="flex flex-col gap-3 mt-4">
                    {myActiveRide.status !== "in_transit" ? (
                      <>
                        <button
                          onClick={() => handleConfirmPickup(myActiveRide.id)}
                          className="w-full bg-blue-600 text-white font-black text-xl py-4 rounded-2xl shadow-lg hover:bg-blue-500 transition-all active:scale-95 flex items-center justify-center gap-3"
                        >
                          Confirm Pickup
                        </button>

                        <button
                          onClick={() => handleDriverCancel(myActiveRide.id)}
                          className="w-full bg-gray-100 text-gray-600 font-bold text-sm py-3 rounded-2xl hover:bg-gray-200 hover:text-red-600 transition-all active:scale-95 flex items-center justify-center gap-2 border border-gray-200"
                        >
                          <FaTimesCircle size={16} /> Cancel Ride
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => handleCompleteRide(myActiveRide.id)}
                        className="w-full bg-green-500 text-black font-black text-xl py-4 rounded-2xl shadow-lg hover:bg-green-400 transition-all active:scale-95 flex items-center justify-center gap-3"
                      >
                        <FaCheckCircle size={22} /> Complete Dropoff
                      </button>
                    )}
                  </div>
                </div>
              </section>
            )}

            {user && isOnDuty && (
              <>
                <h2 className="text-2xl font-black mb-6 text-gray-900">
                  Nearby Requests{" "}
                  <span className="text-gray-400">
                    ({availableRides.length})
                  </span>
                </h2>
                {availableRides.length === 0 ? (
                  <div className="bg-white/50 backdrop-blur-sm rounded-3xl p-10 text-center border border-white/50">
                    <div className="w-10 h-10 border-4 border-gray-200 border-t-black rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-gray-500 font-bold">
                      Scanning for riders...
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {availableRides.map((ride) => (
                      <div
                        key={ride.id}
                        className="bg-white rounded-3xl p-6 border border-gray-100 shadow-xl flex flex-col justify-between hover:border-black/20 transition-all"
                      >
                        <div>
                          <div className="flex justify-between items-start mb-6">
                            <span className="bg-gray-100 text-gray-600 text-[10px] font-black px-4 py-1.5 rounded-full uppercase tracking-wider">
                              {ride.vehicle_type}
                            </span>
                            <span className="text-2xl font-black text-black">
                              ₹{ride.fare}
                            </span>
                          </div>
                          <div className="space-y-4 mb-6">
                            <div className="flex gap-4">
                              <div className="w-2.5 h-2.5 rounded-full bg-black mt-1.5 shadow-sm flex-shrink-0"></div>
                              <p className="text-sm text-gray-700 font-semibold leading-tight">
                                {ride.pickup_location}
                              </p>
                            </div>
                            <div className="flex gap-4">
                              <div className="w-2.5 h-2.5 rounded-full bg-blue-600 mt-1.5 shadow-sm flex-shrink-0"></div>
                              <p className="text-sm text-gray-700 font-semibold leading-tight">
                                {ride.dropoff_location}
                              </p>
                            </div>
                          </div>
                        </div>
                        {ride.pickup_lat && (
                          <button
                            onClick={() =>
                              setExpandedMapId(
                                expandedMapId === ride.id ? null : ride.id,
                              )
                            }
                            className="text-xs font-bold text-blue-600 mb-4 hover:text-blue-800 transition-colors text-left"
                          >
                            {expandedMapId === ride.id
                              ? "Close Route Map"
                              : "Preview Route Map"}
                          </button>
                        )}
                        {expandedMapId === ride.id && ride.pickup_lat && (
                          <div className="h-40 w-full rounded-xl overflow-hidden mb-5 border border-gray-200 shadow-inner">
                            <RyderMap
                              pickup={{
                                lat: ride.pickup_lat,
                                lon: ride.pickup_lon,
                                name: ride.pickup_location,
                              }}
                              dropoff={{
                                lat: ride.dropoff_lat,
                                lon: ride.dropoff_lon,
                                name: ride.dropoff_location,
                              }}
                              setDistance={() => {}}
                            />
                          </div>
                        )}
                        <button
                          onClick={() => handleAcceptRide(ride)}
                          disabled={!!myActiveRide}
                          className={`w-full font-black py-4 rounded-xl transition-all ${myActiveRide ? "bg-gray-100 text-gray-400 cursor-not-allowed" : "bg-black text-white hover:bg-gray-800 shadow-lg active:scale-95"}`}
                        >
                          {myActiveRide
                            ? "Finish Active Job First"
                            : "Accept Ride"}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </main>
  );
}
