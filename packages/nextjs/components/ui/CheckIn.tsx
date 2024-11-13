import React, { useCallback, useEffect, useState } from "react";
import confetti from "canvas-confetti";
import { FaFire, FaInfoCircle } from "react-icons/fa";
import { useAccount } from "wagmi";

type LevelType = "Initiate" | "Operative" | "Enforcer" | "Vanguard" | "Prime";
interface CheckInProps {
  userLevel?: {
    level: LevelType;
  };
}
interface CheckInState {
  consecutiveDays: number;
  lastCheckIn: string | null;
  canCheckIn: boolean;
  level: LevelType;
}

const CheckIn: React.FC<CheckInProps> = ({ userLevel = { level: "Initiate" } }) => {
  const [checkInState, setCheckInState] = useState<CheckInState>({
    consecutiveDays: 0,
    lastCheckIn: null,
    canCheckIn: false,
    level: userLevel?.level || "Initiate",
  });
  const [showTooltip, setShowTooltip] = useState(false);
  const { address } = useAccount();
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (address) {
      fetchCheckInState();
    }
  }, [address]);

  const fetchCheckInState = async () => {
    try {
      const response = await fetch(`/api/CheckIn?address=${address}`);
      const data = await response.json();

      if (!data.lastCheckIn) {
        setCheckInState({
          consecutiveDays: 0,
          lastCheckIn: null,
          canCheckIn: true,
          level: data.level || "Initiate",
        });
      } else {
        setCheckInState(data);
      }
    } catch (error) {
      console.error("Failed to get check-in status:", error);

      setCheckInState({
        consecutiveDays: 0,
        lastCheckIn: null,
        canCheckIn: true,
        level: "Initiate",
      });
    }
  };

  const handleCheckIn = async () => {
    try {
      const response = await fetch("/api/CheckIn", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          address,
          level: userLevel.level,
        }),
      });
      const data = await response.json();
      if (data.success) {
        setIsAnimating(true);
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
        });
        setTimeout(() => setIsAnimating(false), 1000);
        await fetchCheckInState();
      }
    } catch (error) {
      console.error("Check in failed:", error);
    }
  };

  const handleMakeUpCheckIn = async () => {
    try {
      const response = await fetch("/api/CheckIn/makeup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          address,
          level: userLevel.level,
        }),
      });
      const data = await response.json();
      if (data.success) {
        await fetchCheckInState();
      }
    } catch (error) {
      console.error("Failed to re-sign:", error);
    }
  };
  const progressPercentage = (checkInState.consecutiveDays / 100) * 100;

  const canMakeUp = useCallback(() => {
    if (userLevel.level === "Initiate") return false;
    if (!checkInState.lastCheckIn) return false;

    const lastCheckIn = new Date(checkInState.lastCheckIn);
    const now = new Date();

    // UTC+8
    const utc8Last = new Date(lastCheckIn.getTime() + 8 * 60 * 60 * 1000);
    const utc8Now = new Date(now.getTime() + 8 * 60 * 60 * 1000);

    const diffDays = Math.floor((utc8Now.getTime() - utc8Last.getTime()) / (1000 * 60 * 60 * 24));

    // Make up days
    let allowedDays = 0;
    switch (userLevel.level) {
      case "Prime":
        allowedDays = 7;
        break;
      case "Vanguard":
        allowedDays = 5;
        break;
      case "Enforcer":
        allowedDays = 3;
        break;
      case "Operative":
        allowedDays = 1;
        break;
      default:
        allowedDays = 0;
    }

    return diffDays > 1 && diffDays <= allowedDays;
  }, [checkInState.lastCheckIn, userLevel.level]);

  const checkInRules = `
Check-in Rules:

1. Limited to one check-in per day

2. Makeup Check-in Opportunities by Level:
   • Operative:  1 Day
   • Enforcer:   3 Days
   • Vanguard:   5 Days
   • Prime:      7 Days


Check-in Rewards:

100-Day Streak Special Rewards
(Ranked by completion time)

🏆 Top 10:          1 BTC
🥈 Rank 11-200:     2 ETH
🥉 Rank 201-2000:   1 ETH
✨ Rank 2001-10000: 1000 USDT

`.trim();
  const handleMouseEnter = useCallback(() => setShowTooltip(true), []);
  const handleMouseLeave = useCallback(() => setShowTooltip(false), []);

  return (
    <div className="bg-base-400 border border-[#424242] p-4 rounded-lg shadow-lg">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-gray-400 text-sm font-medium mb-2 flex items-center">
            Daily Check-in
            <div className="relative inline-block ml-2">
              <FaInfoCircle
                className="text-gray-400 hover:text-gray-300 cursor-help"
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
              />
              {showTooltip && (
                <div className="absolute z-10 w-64 p-2 mt-2 text-sm text-gray-400 bg-base-300 rounded-lg shadow-lg whitespace-pre-line left-0">
                  {checkInRules}
                </div>
              )}
            </div>
          </h3>
          <div className="flex items-center mb-2">
            <FaFire className="text-yellow-500 mr-2" size={24} />
            <span className="text-white text-3xl font-bold mr-2">{checkInState.consecutiveDays}</span>
            <span className="text-gray-400">Days</span>
          </div>
        </div>
        <div>
          {checkInState.canCheckIn ? (
            <button
              onClick={handleCheckIn}
              className={`px-4 py-2 rounded-full font-bold transition-all duration-300 ${
                isAnimating
                  ? "bg-primary text-white scale-110"
                  : "bg-primary hover:bg-primary-dark text-white hover:scale-105"
              }`}
            >
              GM
            </button>
          ) : (
            canMakeUp() && (
              <button
                onClick={handleMakeUpCheckIn}
                className="px-3 py-2 text-sm rounded-full bg-secondary hover:bg-secondary-dark text-white font-bold transition-all duration-300 hover:scale-105"
              >
                Make Up
              </button>
            )
          )}
        </div>
      </div>
      <div className="w-full border border-[#424242] bg-custom-hover h-4 rounded-full mt-4 relative">
        <div
          style={{ width: `${progressPercentage}%` }}
          className="bg-primary h-full rounded-full transition-all duration-300 ease-in-out"
        ></div>
        <span className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-xs font-bold text-white">
          {checkInState.consecutiveDays} / 100
        </span>
      </div>
    </div>
  );
};

export default CheckIn;
