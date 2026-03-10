"use client";

import { useState, useEffect } from "react";
import { FaMapPin, FaSearch } from "react-icons/fa";

interface AddressAutocompleteProps {
  placeholder: string;
  selectedValue?: string;
  onSelectAddress: (address: {
    name: string;
    lat: string;
    lon: string;
    address?: string;
  }) => void;
  onActivatePinDrop?: () => void;
  isPinActive?: boolean;
}

export default function AddressAutocomplete({
  placeholder,
  selectedValue,
  onSelectAddress,
  onActivatePinDrop,
  isPinActive,
}: AddressAutocompleteProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (selectedValue !== undefined && selectedValue !== query) {
      setQuery(selectedValue);
    }
  }, [selectedValue]);

  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (query.length > 2 && !query.includes(",")) {
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${query}&limit=5&countrycodes=in&viewbox=68.0,25.0,75.0,20.0&bounded=1`,
          );
          const data = await res.json();
          setResults(data);
          setIsOpen(true);
        } catch (error) {
          console.error(error);
        }
      } else {
        setResults([]);
        setIsOpen(false);
      }
    }, 1000);
    return () => clearTimeout(delayDebounceFn);
  }, [query]);

  const handleSelect = (item: any) => {
    setQuery(item.display_name);
    setIsOpen(false);
    onSelectAddress({
      name: item.display_name,
      lat: item.lat,
      lon: item.lon,
      address: item.display_name,
    });
  };

  return (
    <div className="relative w-full">
      <div
        className={`flex items-center bg-gray-100 rounded-xl p-3 border-2 transition-colors ${isPinActive ? "border-blue-500 bg-blue-50" : "border-transparent focus-within:border-black"}`}
      >
        <FaSearch className="text-gray-400 mx-2 flex-shrink-0" size={16} />
        <input
          type="text"
          placeholder={
            isPinActive ? "Click map to set location..." : placeholder
          }
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="bg-transparent w-full outline-none text-gray-900 text-lg placeholder-gray-500 ml-2"
          disabled={isPinActive}
        />
        {onActivatePinDrop && (
          <button
            onClick={onActivatePinDrop}
            className={`p-3 rounded-lg transition-colors ${isPinActive ? "bg-blue-500 text-white shadow-md" : "text-gray-400 hover:bg-gray-200 hover:text-black"}`}
            title="Choose on map"
          >
            <FaMapPin size={18} />
          </button>
        )}
      </div>

      {isOpen && results.length > 0 && (
        <ul className="absolute z-50 w-full bg-white mt-2 rounded-xl shadow-xl border border-gray-100 max-h-60 overflow-y-auto">
          {results.map((item, index) => (
            <li
              key={index}
              onClick={() => handleSelect(item)}
              className="p-4 border-b border-gray-50 hover:bg-gray-50 cursor-pointer text-sm text-gray-700"
            >
              {item.display_name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
