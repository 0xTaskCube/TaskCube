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
      <ParticlesComponent />
      <HeroSection />
    </div>
  );
};

export default Home;
