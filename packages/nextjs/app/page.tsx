"use client";

import { useEffect, useState } from "react";
import HeroSection from "../components/ui/HeroSection";
import ParticlesComponent from "../components/ui/ParticlesComponent";
import type { NextPage } from "next";

const Home: NextPage = () => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  return (
    <div className={`${isVisible ? "animate-fade-in" : "opacity-0"}`}>
      <div className="bg-gradient-to-r from-teal-600 to-teal-700 text-center py-2.5 relative overflow-hidden">
        <div className="animate-marquee whitespace-nowrap flex items-center justify-center gap-2">
          <span className="text-white flex items-center gap-2 font-semibold">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
            </svg>
            <span className="text-lg">Earn BTC by completing check-in task</span>
            <span className="inline-flex items-center rounded-full bg-teal-800 px-2.5 py-0.5 text-xs font-medium text-white">
              New
            </span>
          </span>
        </div>
      </div>
      <ParticlesComponent />
      <HeroSection />
    </div>
  );
};

export default Home;
