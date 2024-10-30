import { FC } from "react";
import Image from "next/image";

// 定义官方地址列表
export const OFFICIAL_ADDRESSES = [
  "0xB1CD9f3c65496ddD185F81d5E5b0BC9004535521",
  "0xB26f39865a21D56926c9cdd0EcD95956c8a76663",
];

// 判断是否为官方任务的函数
export const isOfficialTask = (creatorAddress: string) => {
  return OFFICIAL_ADDRESSES.includes(creatorAddress);
};

// 官方认证标签组件
export const OfficialBadge: FC = () => {
  return (
    <span className="inline-flex items-center ml-2">
      <div className="relative w-5 h-5 sm:w-6 sm:h-6">
        <Image src="/logo.png" alt="Official Verification" width={24} height={24} className="animate-shine" priority />
      </div>
    </span>
  );
};
