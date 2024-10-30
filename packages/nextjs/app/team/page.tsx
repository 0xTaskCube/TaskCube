"use client";

import React, { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Loading } from "../../components/ui/Loading";
import ParticlesComponent from "../../components/ui/ParticlesComponent";
import { useAccount } from "wagmi";

// 动态引入 HighchartsTreegraph 组件
const HighchartsTreegraph = dynamic(() => import("./_components/HighchartsTreegraph"), { ssr: false });

const TeamPage: React.FC = () => {
  const [treeData, setTreeData] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const { address } = useAccount();

  useEffect(() => {
    if (!address) return;

    const fetchInviteData = async () => {
      try {
        const response = await fetch(`/api/invites?inviter=${address}`);
        const data = await response.json();
        setTreeData(data);
        setLoading(false);
      } catch (err) {
        setError("Failed to fetch invite data");
        setLoading(false);
      }
    };

    fetchInviteData();
  }, [address]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="bg-base-400 p-8 rounded-lg">
          <Loading size="lg" color="primary" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="border border-[#424242] bg-base-400 p-8 rounded-lg text-white">Error: {error}</div>
      </div>
    );
  }

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
