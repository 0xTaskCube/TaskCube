"use client";

import React, { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import ParticlesComponent from "../../components/ui/ParticlesComponent";
import { useAccount } from "wagmi";

// 动态引入 HighchartsTreegraph 组件，并禁用 SSR
const HighchartsTreegraph = dynamic(() => import("./_components/HighchartsTreegraph"), { ssr: false });

const TeamPage: React.FC = () => {
  const [treeData, setTreeData] = useState<any[]>([]); // 保存树状数据
  const [loading, setLoading] = useState<boolean>(true); // 加载状态
  const [error, setError] = useState<string | null>(null); // 错误状态
  const { address } = useAccount(); // 获取当前用户的钱包地址

  useEffect(() => {
    if (!address) return; // 如果没有钱包连接，则返回

    // 从 API 获取邀请数据
    const fetchInviteData = async () => {
      try {
        const response = await fetch(`/api/invites?inviter=${address}`); // 使用钱包地址发起请求
        const data = await response.json();
        setTreeData(data); // 将响应的数据设为树状数据
        setLoading(false); // 关闭加载状态
      } catch (err) {
        setError("Failed to fetch invite data");
        setLoading(false);
      }
    };

    fetchInviteData(); // 执行请求
  }, [address]);

  if (loading) {
    return <div>Loading...</div>; // 显示加载状态
  }

  if (error) {
    return <div>Error: {error}</div>; // 显示错误状态
  }

  // 渲染页面内容
  return (
    <div className="bg-black text-white flex justify-center items-center p-6">
      <div className="w-full">
        <h1 className="text-4xl font-bold text-center mt-10">Team Tree</h1>
        <ParticlesComponent />
        <HighchartsTreegraph data={treeData} />
      </div>
    </div>
  );
};

export default TeamPage;
