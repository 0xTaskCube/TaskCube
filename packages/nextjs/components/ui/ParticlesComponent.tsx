"use client";

// @ts-ignore
import React from "react";
import Particles from "react-tsparticles";
import { loadSlim } from "tsparticles-slim";

// @ts-ignore

// @ts-ignore

// @ts-ignore

// @ts-ignore

// @ts-ignore

// @ts-ignore

// @ts-ignore

// @ts-ignore

// @ts-ignore

// @ts-ignore

const ParticlesComponent = () => {
  const particlesInit = async (main: any) => {
    await loadSlim(main); // 使用 Slim 版本的 tsparticles
  };

  return (
    <Particles
      id="tsparticles"
      init={particlesInit}
      options={{
        fpsLimit: 60,
        interactivity: {
          events: {
            onHover: { enable: true, mode: "repulse" },
            onClick: { enable: true, mode: "push" },
            resize: true,
          },
        },
        particles: {
          number: { value: 100, density: { enable: true, area: 800 } },
          color: { value: "#ffffff" },
          shape: {
            type: "circle",
            stroke: { width: 0, color: "#000000" },
            polygon: { nb_sides: 5 },
          },
          opacity: { value: 0.5, anim: { enable: false } },
          size: { value: 3, anim: { enable: false } },
          lineLinked: { enable: true, distance: 150, color: "#ffffff", opacity: 0.4, width: 1 },
          move: {
            enable: true,
            speed: 2,
            direction: "none",
            random: false,
            straight: false,
            outMode: "out",
            bounce: false,
          },
        },
        detectRetina: true,
      }}
    />
  );
};

export default ParticlesComponent;
