import React, { useCallback, useEffect, useState } from "react";
import { FaFire, FaInfoCircle } from "react-icons/fa";
import { useAccount } from "wagmi";

type LevelType = "Initiate" | "Operative" | "Enforcer" | "Vanguard" | "Prime";

interface CheckInState {
  consecutiveDays: number;
  lastCheckIn: string | null;
  canCheckIn: boolean;
  level: LevelType;
}

const CheckIn: React.FC = () => {
  const [checkInState, setCheckInState] = useState<CheckInState>({
    consecutiveDays: 0,
    lastCheckIn: null,
    canCheckIn: false,
    level: "Initiate",
  });
  const [showTooltip, setShowTooltip] = useState(false);
  const { address } = useAccount();

  useEffect(() => {
    if (address) {
      fetchCheckInState();
    }
  }, [address]);

  const fetchCheckInState = async () => {
    try {
      const response = await fetch(`/api/CheckIn?address=${address}`);
      const data = await response.json();
      setCheckInState(data);
    } catch (error) {
      console.error("获取签到状态失败:", error);
    }
  };

  const handleCheckIn = async () => {
    try {
      const response = await fetch("/api/CheckIn", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ address }),
      });
      const data = await response.json();
      if (data.success) {
        await fetchCheckInState(); // 重新获取最新状态
      }
    } catch (error) {
      console.error("签到失败:", error);
    }
  };

  const handleMakeUpCheckIn = async () => {
    try {
      const response = await fetch("/api/CheckIn/makeup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ address }),
      });
      const data = await response.json();
      if (data.success) {
        await fetchCheckInState(); // 重新获取最新状态
      }
    } catch (error) {
      console.error("补签失败:", error);
    }
  };
  const progressPercentage = (checkInState.consecutiveDays / 100) * 100;
  const canMakeUp = ["Operative", "Enforcer", "Vanguard", "Prime"].includes(checkInState.level);

  const checkInRules = `
签到规则：
1. 每天只能签到一次
2. 连续签到可提升等级：
   - 25天: Operative
   - 50天: Enforcer
   - 75天: Vanguard
   - 100天: Prime
3. 高等级可获得补签机会：
   - Operative: 1天
   - Enforcer: 3天
   - Vanguard: 5天
   - Prime: 7天
4. 签到可获得积分奖励
5. 保持连续签到以获得更多奖励！
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
            <button onClick={handleCheckIn} className="text-primary hover:text-primary-dark transition-colors">
              GM
            </button>
          ) : (
            canMakeUp && (
              <button
                onClick={handleMakeUpCheckIn}
                className="text-secondary hover:text-secondary-dark transition-colors"
              >
                Make Up
              </button>
            )
          )}
        </div>
      </div>
      {!checkInState.canCheckIn && (
        <div className="w-full bg-gray-700 h-2 rounded-full mt-4">
          <div style={{ width: `${progressPercentage}%` }} className="bg-primary h-full rounded-full"></div>
        </div>
      )}
    </div>
  );
};

export default CheckIn;
