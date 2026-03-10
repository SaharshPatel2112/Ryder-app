"use client";

import { FaMotorcycle, FaCarSide, FaShuttleVan } from "react-icons/fa";
import { MdElectricRickshaw } from "react-icons/md";
import { RiCarFill } from "react-icons/ri";

interface RideOption {
  id: string;
  name: string;
  icon: any;
  multiplier: number;
  capacity: number;
}

const RIDE_OPTIONS: RideOption[] = [
  {
    id: "bike",
    name: "Moto",
    icon: <FaMotorcycle size={28} />,
    multiplier: 8,
    capacity: 1,
  },
  {
    id: "auto",
    name: "Auto",
    icon: <MdElectricRickshaw size={32} className="text-yellow-500" />,
    multiplier: 12,
    capacity: 3,
  },
  {
    id: "car",
    name: "Ryder Go",
    icon: <FaCarSide size={28} />,
    multiplier: 18,
    capacity: 4,
  },
  {
    id: "suv",
    name: "Ryder XL",
    icon: <FaShuttleVan size={28} />,
    multiplier: 24,
    capacity: 6,
  },
  {
    id: "premium",
    name: "Premium",
    icon: <RiCarFill size={28} />,
    multiplier: 32,
    capacity: 4,
  },
];

export default function RideSelector({
  distance,
  selectedRide,
  setSelectedRide,
}: any) {
  return (
    <div className="flex flex-col gap-3 mt-4 w-full">
      <h3 className="text-gray-500 font-bold uppercase text-xs tracking-wider mb-1">
        Available Rides
      </h3>

      {RIDE_OPTIONS.map((ride) => {
        const fare = (parseFloat(distance) * ride.multiplier).toFixed(0);
        const isSelected = selectedRide === ride.id;

        return (
          <div
            key={ride.id}
            onClick={() => setSelectedRide(ride.id)}
            className={`cursor-pointer rounded-2xl p-4 flex items-center justify-between border-2 transition-all ${
              isSelected
                ? "border-black bg-gray-50 shadow-md transform scale-[1.02]"
                : "border-transparent bg-white shadow-sm hover:bg-gray-50 hover:border-gray-200"
            }`}
          >
            <div className="flex items-center gap-4">
              <div className="text-gray-800">{ride.icon}</div>
              <div>
                <p className="font-bold text-lg text-gray-900 leading-tight">
                  {ride.name}
                </p>
                <div className="flex items-center gap-1 text-xs text-gray-500 font-medium mt-1">
                  <span>
                    {ride.capacity} Seat{ride.capacity > 1 ? "s" : ""}
                  </span>
                  <span>•</span>
                  <span>2 min away</span>
                </div>
              </div>
            </div>

            <div className="text-right">
              <p className="font-black text-2xl text-black">₹{fare}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
