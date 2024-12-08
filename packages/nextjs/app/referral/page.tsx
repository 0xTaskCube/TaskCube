"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FaLink, FaShareAlt } from "react-icons/fa";
import { useAccount } from "wagmi";
import { Loading } from "~~/components/ui/Loading";

const ReferralPage = () => {
  const { address: currentAddress } = useAccount();
  const [copied, setCopied] = useState(false);
  const [referralLink, setReferralLink] = useState("");
  const [referralReward, setReferralReward] = useState("0");
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    if (typeof window !== "undefined" && currentAddress) {
      const baseUrl = `${window.location.protocol}//${window.location.host}`;

      setReferralLink(`${baseUrl}/?inviter=${currentAddress}`);
      setLoading(false);
    }
  }, [currentAddress]);

  useEffect(() => {
    const fetchReferralRewards = async () => {
      if (currentAddress) {
        try {
          const response = await fetch(`/api/task/getBounty?address=${currentAddress}`);
          const data = await response.json();
          console.log("Obtained reward data:", data);

          if (data.success) {
            let totalReferralRewards = 0;

            data.details.distributions.forEach((dist: any) => {
              if (dist.directInviterAddress === currentAddress) {
                totalReferralRewards += Number(dist.directInviterReward) || 0;
              }
              if (dist.indirectInviterAddress === currentAddress) {
                totalReferralRewards += Number(dist.indirectInviterReward) || 0;
              }
            });

            setReferralReward(totalReferralRewards.toFixed(2));
          }
        } catch (error) {
          console.error("Failed to obtain invitation reward:", error);
        }
      }
    };

    fetchReferralRewards();
  }, [currentAddress]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Twitter
  const handleTwitterShare = () => {
    const tweetText = encodeURIComponent(
      `🎉 Join TaskCube - Your Gateway to Web3 Tasks! 🚀\n\n` +
        `💰 Complete tasks, earn rewards\n` +
        `🤝 Join using my referral link:\n` +
        `${referralLink}\n\n` +
        `#TaskCube #Web3 #Crypto`,
    );

    const twitterShareUrl = `https://x.com/intent/tweet?text=${tweetText}`;
    window.open(twitterShareUrl, "_blank");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loading />
      </div>
    );
  }

  return (
    <div className="md:mt-20 flex flex-col items-center justify-center bg-black text-white p-4">
      {/* Top Section */}
      <div className="border border-[#424242] bg-base-400 rounded-xl shadow-lg p-6 max-w-4xl w-full text-center mb-8">
        <h1 className="text-2xl font-bold">Earn 6% of your friend's task rewards</h1>
        <p className="text-sm mt-4 text-left md:ml-4">
          Share your referral link or invitation code (wallet address) to earn: • 5% Direct Reward from referred
          users'task earnings • 1% Indirect Reward from sub-referred users'task earnings All rewards are
          automaticallyallocated and can be claimed anytime via Dashboard.
        </p>
      </div>
      <div className="shadow-lg w-full max-w-4xl">
        <h2 className="text-xl text-gray-400">Your referral link</h2>
        <p className="text-sm font-bold p-4 mt-2 border border-[#424242] bg-base-400 rounded-xl">{referralLink}</p>
      </div>
      {/* Stats Section */}
      <div className="flex flex-col md:flex-row items-center justify-center gap-6 w-full max-w-4xl">
        {/* Referral Points Card */}
        <div className="border border-[#424242] bg-base-400 rounded-xl shadow-lg p-6 w-full md:w-1/2">
          <h2 className="text-lg text-gray-400">Referral reward</h2>
          <p className="text-4xl font-bold mt-2">{referralReward} USDT</p>
        </div>

        {/* Action Buttons */}
        <div className="bg-base-400 rounded-xl shadow-lg w-full md:w-1/2 flex flex-col gap-4">
          <button
            className="flex items-center justify-center gap-2 bg-black text-white py-3 px-4 rounded-lg border border-[#424242] hover:bg-primary mb-2"
            onClick={handleCopyLink}
          >
            <FaLink size={20} />
            {copied ? "Link Copied!" : "Copy referral link"}
          </button>
          <button
            onClick={handleTwitterShare}
            className="flex items-center justify-center gap-2 bg-black text-white py-3 px-4 rounded-lg border border-[#424242] hover:bg-primary"
          >
            <FaShareAlt size={20} />
            Share on X
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReferralPage;
