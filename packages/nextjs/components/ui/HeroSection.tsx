"use client";

import React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import TextLoop from "../../lib/TextLoop";

const HeroSection = () => {
  const router = useRouter();
  const loopItems = [
    "Find a task that suits you.",
    "Post a task.",
    "Complete daily task.",
    "Invite friends.",
    "Component team.",
    "Take control of your wallet.",
    "Earn without cost.",
  ];

  const handleStartClick = (e: React.MouseEvent) => {
    e.preventDefault();

    const urlParams = new URLSearchParams(window.location.search);
    const inviter = urlParams.get("inviter");

    if (inviter) {
      router.push(`/start?inviter=${inviter}`);
    } else {
      router.push("/start");
    }
  };

  return (
    <section
      id="home"
      className="h-full items-center justify-center text-center container mx-auto pt-10"
      style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M11 18c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm48 25c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm-43-7c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm63 31c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM34 90c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm56-76c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM12 86c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm28-65c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm23-11c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm-6 60c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm29 22c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zM32 63c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm57-13c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm-9-21c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM60 91c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM35 41c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM12 60c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2z' fill='%239C92AC' fill-opacity='0.19' fill-rule='evenodd'/%3E%3C/svg%3E")`,
        backgroundPosition: "center",
        backgroundSize: "cover",
        backgroundRepeat: "no-repeat",
      }}
    >
      <div className="flex flex-col text-center items-center justify-center animate-fadeIn animation-delay-5 my-0 py-10 sm:py-32 md:pt-30 md:flex-row md:space-x-2 md:text-left">
        <div className="md:w-2/5 w-3/5 ">
          <Image src="/logo.png" alt="profile-pic" width={400} height={400} className="rounded-full w-full h-auto" />
        </div>
        <div className="md:w-3/5">
          <h1 className="text-4xl text-white font-bold mt-6 md:mt-0 md:text-7xl"> Earn with Task Cube!</h1>
          <h1 className="text-lg mt-4 mb-6 md:text-2xl text-white">
            Earn <span className="font-semibold text-teal-600">cryptocurrencies</span> easily with the best platform{" "}
            <br />
            <p className="font-semibold text-white">
              You can <TextLoop loopItems={loopItems} delay={3000} />
            </p>
            <br />
          </h1>
          <button
            onClick={handleStartClick}
            className="hover:cursor-pointer shadow-xl hover:shadow-2xl text-neutral-100 font-semibold px-6 py-3 bg-teal-600 rounded-lg hover:bg-teal-700"
          >
            Get Started
          </button>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
