"use client";

import React, { useEffect, useState } from "react";
import { FaLink, FaShareAlt } from "react-icons/fa";
import { useAccount } from "wagmi";

const ReferralPage = () => {
  const { address: currentAddress } = useAccount();
  const [referrerAddress] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const referralLink = `http://localhost:3000/referral?address=${currentAddress}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const address = urlParams.get("address");

    // 如果有 address 参数，直接重定向到根目录
    if (address) {
      window.location.href = "/";
    }
  }, []);

  useEffect(() => {
    if (referrerAddress && currentAddress) {
      fetch("/api/invites", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ inviter: referrerAddress, invitee: currentAddress }),
      })
        .then(response => response.json())
        .then(data => {
          if (data.status === "success") {
            console.log(data.message);
          } else {
            console.error(data.message);
          }
        })
        .catch(error => {
          console.error("Error saving invitation data:", error);
        });
    }
  }, [referrerAddress, currentAddress]);

  return (
    <div className="md:mt-20 flex flex-col items-center justify-center bg-black text-white p-4">
      {/* Top Section */}
      <div className=" border border-[#424242] bg-base-400 rounded-xl shadow-lg p-6 max-w-4xl w-full text-center mb-8">
        <h1 className="text-2xl font-bold">You earn 10% of the points your friends make</h1>
        <p className="text-sm mt-4">
          Referral deposits are supported on Ethereum mainnet and Layer 2s. To activate the referral, users need to use
          the referral link and deposit ETH on mainnet to start accruing referral points. Once a referral is active, the
          referring user will accrue 10% of all points, across all chains.
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
          <h2 className="text-lg text-gray-400">Referral Points</h2>
          <p className="text-4xl font-bold mt-2">0 Pts</p>
        </div>

        {/* Action Buttons */}
        <div className=" bg-base-400 rounded-xl shadow-lg  w-full md:w-1/2 flex flex-col gap-4">
          <button
            className="flex items-center justify-center gap-2 bg-black text-white py-3 px-4 rounded-lg border border-[#424242] hover:bg-primary mb-2"
            onClick={handleCopyLink}
          >
            <FaLink size={20} />
            {copied ? "Link Copied!" : "Copy referral link"}
          </button>
          <button className="flex items-center justify-center gap-2 bg-black text-white py-3 px-4 rounded-lg border border-[#424242] hover:bg-primary">
            <FaShareAlt size={20} />
            Share
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReferralPage;
