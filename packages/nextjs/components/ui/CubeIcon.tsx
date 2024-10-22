import React from "react";

type LevelType = "Initiate" | "Operative" | "Enforcer" | "Vanguard" | "Prime";

interface CubeIconProps {
  level: LevelType;
}

const CubeIcon: React.FC<CubeIconProps> = ({ level }) => {
  return (
    <div className={`cube-icon cube-${level.toLowerCase()}`}>
      <div className="cube">
        <div className="axis-switcher">
          {[0, 1].map(comp => (
            <div key={comp} className="cube__comp">
              {[0, 1, 2, 3, 4].map(face => (
                <div key={face} className="cube__face"></div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default CubeIcon;
